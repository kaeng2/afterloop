/**
 * 분쟁 읽기 (SPEC v2.2 9-4장). **조회만** 한다 — 상태를 바꾸는 호출(send-message, make-offer,
 * accept-claim)은 `src/exec/`가 맡는다. 모든 HTTP는 `PayPalClient.get`을 지난다.
 *
 * 응답은 신뢰하지 않는 입력이다: zod로 필요한 필드만 받고 모르는 필드는 버린다(zod가 기본으로 떼낸다).
 * 필수 필드가 없으면 **어떤 필드인지**만 적은 예외를 던진다 (응답 값은 싣지 않는다).
 *
 * 개인정보(SPEC 10장): 구매자 이름·이메일·주소는 스키마에 선언하지 않으므로 여기서 걸러진다.
 * 구매자 메시지 원문(`messages[].content`)만 분류 입력용으로 받아 두고, 로그·예외에는 넣지 않는다.
 *
 * 금액·단계·채널을 `BoardState`로 바꾸는 것은 `./mapper`의 일이다 (이 파일은 꼴만 검증한다).
 */
import { z } from 'zod';

import type { PayPalClient } from '@/types';

/** 분쟁 목록·상세의 공통 경로. */
export const DISPUTES_PATH = '/v1/customer/disputes';

/** 쪽 넘기기 상한. `links[rel=next]`를 이만큼만 따라간다 (끝없는 순환을 막는다). */
export const MAX_PAGES = 20;

/** `page_size`를 주지 않았을 때 쓰는 값과 PayPal이 받는 상한. */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;

/** 분쟁 ID 꼴: `PP-`로 시작하는 영문·숫자·하이픈. 그 밖은 호출 전에 거부한다. */
const DISPUTE_ID_PATTERN = /^PP-[A-Za-z0-9-]{1,60}$/;

/** 다음 쪽 링크가 벗어나면 안 되는 origin (live 주소로 끌려가지 않게). */
const SANDBOX_ORIGIN = 'https://api-m.sandbox.paypal.com';

// ── 스키마 ───────────────────────────────────────────────────────────────────

const moneySchema = z.object({ currency_code: z.string(), value: z.string() });

const linkSchema = z.object({ rel: z.string(), href: z.string().optional(), method: z.string().optional() });

/** 분쟁에 걸린 거래. 구매자는 식별자(`payer_id`)만 받는다 (이름·이메일은 받지 않는다). */
const transactionSchema = z.object({
  seller_transaction_id: z.string().optional(),
  buyer_transaction_id: z.string().optional(),
  transaction_status: z.string().optional(),
  gross_amount: moneySchema.optional(),
  buyer: z.object({ payer_id: z.string().optional() }).optional(),
});

/** 단계·채널·통화는 여기서 문자열로 받고, 아는 값인지는 `./mapper`가 판정한다 (모르면 예외). */
const commonFields = {
  dispute_id: z.string().min(1),
  reason: z.string().min(1),
  status: z.string().optional(),
  dispute_state: z.string().optional(),
  dispute_life_cycle_stage: z.string().min(1),
  dispute_channel: z.string().min(1),
  dispute_amount: moneySchema,
  seller_response_due_date: z.string().optional(),
  buyer_response_due_date: z.string().optional(),
  create_time: z.string().optional(),
  update_time: z.string().optional(),
  disputed_transactions: z.array(transactionSchema).optional().default([]),
  links: z.array(linkSchema).optional().default([]),
};

/** 목록의 항목 1건. */
export const disputeSummarySchema = z.object(commonFields);

/**
 * 상세 1건. `messages[].content`는 구매자가 쓴 원문이다 (`toClassifyInput`에만 쓰고 로그에 남기지 않는다).
 */
export const disputeDetailSchema = z.object({
  ...commonFields,
  messages: z
    .array(z.object({ posted_by: z.string(), content: z.string(), time_posted: z.string().optional() }))
    .optional()
    .default([]),
});

const disputeListSchema = z.object({
  items: z.array(disputeSummarySchema).optional().default([]),
  links: z.array(linkSchema).optional().default([]),
});

export type DisputeSummary = z.infer<typeof disputeSummarySchema>;
export type DisputeDetail = z.infer<typeof disputeDetailSchema>;
export type DisputeLink = z.infer<typeof linkSchema>;

// ── 검증 ─────────────────────────────────────────────────────────────────────

/** 틀린 필드 이름만 모은다 (값은 싣지 않는다). */
function fieldNames(error: z.ZodError): string {
  const names = new Set(error.issues.map((issue) => (issue.path.length === 0 ? '(응답 전체)' : issue.path.join('.'))));
  return [...names].join(', ');
}

/** zod 검증. 실패하면 어떤 필드가 문제인지만 적은 예외를 던진다. */
function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${what}: 응답에 필요한 필드가 없거나 꼴이 다르다 (${fieldNames(result.error)})`);
  }
  return result.data;
}

/** 상세 응답(또는 그 꼴로 만든 값)을 검증한다. `./mapper`가 변환 전에 한 번 더 부른다. */
export function parseDisputeDetail(value: unknown): DisputeDetail {
  return parseOrThrow(disputeDetailSchema, value, '분쟁 상세');
}

/** 목록 항목을 검증한다. */
export function parseDisputeSummary(value: unknown): DisputeSummary {
  return parseOrThrow(disputeSummarySchema, value, '분쟁 목록 항목');
}

// ── 경로 만들기 ──────────────────────────────────────────────────────────────

export type ListDisputesOptions = {
  /** 한 쪽에 받을 건수 (1~50). 기본 50 */
  pageSize?: number;
  /** 예: `['REQUIRED_ACTION', 'UNDER_REVIEW']`. 쉼표로 이어 보낸다 */
  disputeState?: string[];
  /** ISO 8601. 이 시각 이후에 만들어진 분쟁만 */
  startTime?: string;
  /** 특정 거래에 걸린 분쟁만 */
  disputedTransactionId?: string;
};

/**
 * 목록 경로. 쿼리 값은 `URLSearchParams`로 퍼센트 인코딩한다
 * (클라이언트의 path 검사가 공백·`://`를 막는다. T002 재검증 의견 5).
 */
export function buildListPath(opts: ListDisputesOptions = {}): string {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`pageSize는 1~${MAX_PAGE_SIZE}의 정수여야 한다`);
  }

  const query = new URLSearchParams();
  query.set('page_size', String(pageSize));
  if (opts.disputeState !== undefined && opts.disputeState.length > 0) {
    query.set('dispute_state', opts.disputeState.join(','));
  }
  if (opts.startTime !== undefined) query.set('start_time', opts.startTime);
  if (opts.disputedTransactionId !== undefined) query.set('disputed_transaction_id', opts.disputedTransactionId);

  return `${DISPUTES_PATH}?${query.toString()}`;
}

/**
 * `links[rel=next]` → 다음 쪽의 상대 경로. 없으면 null.
 * 샌드박스를 벗어나는 링크는 따라가지 않고 예외다 (응답은 신뢰하지 않는 입력이다).
 */
export function nextPath(links: DisputeLink[]): string | null {
  const next = links.find((link) => link.rel.toLowerCase() === 'next');
  if (next === undefined || next.href === undefined || next.href === '') return null;

  let url: URL;
  try {
    url = new URL(next.href);
  } catch {
    throw new Error('분쟁 목록: 다음 쪽 링크(links[rel=next].href)를 해석할 수 없다');
  }
  if (url.origin !== SANDBOX_ORIGIN) {
    throw new Error('분쟁 목록: 다음 쪽 링크가 샌드박스 주소를 벗어난다');
  }
  return `${url.pathname}${url.search}`;
}

/** `PP-`로 시작하는 꼴만 받는다. 받은 값은 예외 문구에 싣지 않는다 (비밀값이 섞여 올 수 있다). */
export function assertDisputeId(disputeId: string): void {
  if (typeof disputeId !== 'string' || !DISPUTE_ID_PATTERN.test(disputeId)) {
    throw new Error('분쟁 ID 꼴이 아니다 ("PP-"로 시작하는 영문·숫자·하이픈만)');
  }
}

// ── 조회 ─────────────────────────────────────────────────────────────────────

/**
 * 분쟁 목록. `links[rel=next]`가 있으면 다음 쪽까지 이어 읽는다 (최대 `MAX_PAGES`쪽).
 * 상한에 걸리면 그때까지 모은 것을 돌려준다 (호출하는 쪽이 조건을 좁혀 다시 부른다).
 */
export async function listDisputes(client: PayPalClient, opts: ListDisputesOptions = {}): Promise<DisputeSummary[]> {
  let path = buildListPath(opts);
  const out: DisputeSummary[] = [];
  const visited = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (visited.has(path)) break; // 같은 쪽을 가리키는 next 링크 (제자리 돌기)
    visited.add(path);

    const res = await client.get(path);
    if (res.status !== 200) throw new Error(`분쟁 목록 조회 실패 (HTTP ${res.status})`);

    const body = parseOrThrow(disputeListSchema, res.body, '분쟁 목록');
    out.push(...body.items);

    const next = nextPath(body.links);
    if (next === null) break;
    path = next;
  }

  return out;
}

/** 분쟁 상세 1건. */
export async function getDispute(client: PayPalClient, disputeId: string): Promise<DisputeDetail> {
  assertDisputeId(disputeId); // 호출 전에 거부한다 (틀린 ID로는 요청이 나가지 않는다)

  const res = await client.get(`${DISPUTES_PATH}/${disputeId}`);
  if (res.status !== 200) throw new Error(`분쟁 상세 조회 실패 (HTTP ${res.status})`);

  return parseDisputeDetail(res.body);
}
