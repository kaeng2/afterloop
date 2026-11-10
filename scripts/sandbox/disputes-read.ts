/**
 * `npm run sandbox:disputes`가 하는 일 (T029, SPEC v2.2 9-4장). **조회만** 한다.
 *
 * 분쟁 목록(`listDisputes`) → 건별 상세(`getDispute`) → `toBoardState`로 변환까지
 * 실제 샌드박스에 대고 한 번 돌려 본다. 변환은 T003(`@/paypal/disputes`, `@/paypal/mapper`)의
 * 함수를 그대로 쓴다 — 여기서 다시 구현하지 않는다.
 *
 * 여기에는 진입점이 없다 (단위 테스트가 그대로 import한다). 명령줄 처리는 `disputes.ts`가 한다.
 * 분쟁 상태를 바꾸는 호출(send-message, make-offer, accept-claim 등)은 만들지 않는다.
 *
 * 출력에 들어가는 것: 분쟁 ID·reason·status·단계·채널·금액(센트)·기한·허용된 수·다른 링크(rel 이름)·
 * 구매자 글 **개수**·이전 INR 분쟁 수.
 * 들어가지 않는 것: 구매자 이름·이메일·주소·메시지 원문, `payer_id`, Secret·토큰.
 */
import { kstStamp } from './last-run';
import { failureLine } from './paypal';
import { getDispute, listDisputes, type DisputeLink, type DisputeSummary } from '@/paypal/disputes';
import { buyerKeyOf, countPriorInrDisputes, toBoardState, toClassifyInput } from '@/paypal/mapper';
import type { BoardState, PayPalClient } from '@/types';

/** 목록을 한 번에 받는 건수 (PayPal 상한 50). 분쟁 3건짜리 데모라 한 쪽으로 끝난다. */
const PAGE_SIZE = 50;

/** 변환에 성공한 분쟁 1건 — 화면·기록에 그대로 쓸 수 있는 값만 담는다. */
export type DisputeReadRow = {
  disputeId: string;
  reason: string;
  /** 분쟁 상세의 `status` (예: `UNDER_REVIEW`). 응답에 없으면 빈 문자열 */
  status: string;
  stage: BoardState['stage'];
  channel: BoardState['channel'];
  amountCents: number;
  /** `seller_response_due_date`(없으면 구매자 기한). 둘 다 없으면 빈 문자열 */
  dueDate: string;
  allowedMoves: BoardState['allowedMoves'];
  /** `links[].rel` 중 `self`도 `MoveType`도 아닌 것 (응답 순서). 이 앱이 쓰지 않는 길이 뭔지 보여 준다 */
  otherActions: string[];
  /** 구매자가 쓴 글의 **개수**만 (`toClassifyInput`의 `buyerMessages.length`). 원문은 담지 않는다 */
  buyerTextCount: number;
  /** 같은 구매자의 이전 미수령(INR) 분쟁 수 — 목록에서 센다 (구매자 식별자는 싣지 않는다) */
  buyerPriorInrDisputes: number;
};

/** 변환하지 못한 분쟁 1건. `detail`에는 어떤 필드가 문제인지만 담는다 (값은 싣지 않는다). */
export type DisputeReadProblem = { disputeId: string; detail: string };

export type DisputeReadOutcome = {
  /** 목록에 들어 있던 분쟁 수 (변환 실패를 포함한다) */
  listed: number;
  rows: DisputeReadRow[];
  problems: DisputeReadProblem[];
};

/**
 * 추적·배송 기록은 주문 상세에서 와야 하는 값이다 (`npm run sandbox:check`가 읽는다).
 * 이 스크립트는 분쟁만 읽으므로 변환에는 false를 넣고, 그 사실을 출력에 적는다.
 * 지어낸 값이 `BoardState`에 섞이지 않게 여기 한곳에 모아 둔다.
 */
const TRACKING_UNKNOWN = { hasTracking: false, hasDeliveredTracking: false } as const;

/** 위 가정을 사람에게 알리는 문구. 보고서·`last-run.md`에도 같은 문장이 들어간다. */
export const TRACKING_NOTE =
  '추적·배송 기록(hasTracking·hasDeliveredTracking)은 주문 상세에서 오는 값이라 여기서는 false로 두고 변환했다 (`npm run sandbox:check`가 읽는다).';

/**
 * 같은 구매자의 이전 INR 분쟁 수. 구매자 식별자(`payer_id`)가 없는 분쟁은 0으로 둔다
 * (셀 수 없으면 세지 않는다 — 추측하지 않는다). 식별자 자체는 돌려주지 않는다.
 */
function priorInrDisputes(summaries: DisputeSummary[], current: DisputeSummary): number {
  try {
    return countPriorInrDisputes(summaries, buyerKeyOf(current), current.dispute_id);
  } catch {
    return 0;
  }
}

/**
 * `allowedMoves`로 옮겨지는 rel 4개(`@/paypal/mapper`의 `MoveType` 순서)와 자기 링크.
 * `otherActions`는 이 목록에 없는 rel만 모은다.
 */
const KNOWN_RELS: readonly string[] = ['self', 'send_message', 'make_offer', 'provide_evidence', 'accept_claim'];

/**
 * 응답에 온 링크 가운데 이 앱이 수로 다루지 않는 것의 rel 이름 (응답 순서 그대로).
 * 같은 rel이 두 번 와도 한 번만 적는다. 주소(`href`)는 담지 않는다.
 */
function otherActionsOf(links: DisputeLink[]): string[] {
  const out: string[] = [];
  for (const link of links) {
    const rel = link.rel.trim();
    if (rel === '' || KNOWN_RELS.includes(rel)) continue;
    if (out.includes(rel)) continue;
    out.push(rel);
  }
  return out;
}

/**
 * 목록을 읽고 건별로 상세를 읽어 `BoardState`로 바꾼다.
 * 한 건이 변환되지 않아도 나머지는 계속 읽는다 (문제는 `problems`에 쌓인다).
 * 목록 조회 자체가 실패하면 던진다 (호출하는 쪽이 종료 코드를 정한다).
 */
export async function runDisputesRead(client: PayPalClient): Promise<DisputeReadOutcome> {
  const summaries = await listDisputes(client, { pageSize: PAGE_SIZE });

  const rows: DisputeReadRow[] = [];
  const problems: DisputeReadProblem[] = [];

  for (const summary of summaries) {
    try {
      const detail = await getDispute(client, summary.dispute_id);
      const buyerPriorInrDisputes = priorInrDisputes(summaries, summary);
      const board = toBoardState(detail, { ...TRACKING_UNKNOWN, buyerPriorInrDisputes, isDemo: false });
      // 구매자 글은 여기서 다시 모으지 않는다 — T003의 변환을 그대로 쓰고 **개수만** 꺼낸다.
      // 추적 값은 `toBoardState`에 넘긴 것과 같은 가정(`TRACKING_UNKNOWN`)이고, 택배사 이벤트는 읽지 않는다.
      const classify = toClassifyInput(detail, { ...TRACKING_UNKNOWN, buyerPriorInrDisputes, trackingEvents: [] });
      rows.push({
        disputeId: board.disputeId,
        reason: board.reason,
        status: detail.status?.trim() ?? '',
        stage: board.stage,
        channel: board.channel,
        amountCents: board.amountCents,
        dueDate: board.dueDate,
        allowedMoves: board.allowedMoves,
        otherActions: otherActionsOf(detail.links),
        buyerTextCount: classify.buyerMessages.length,
        buyerPriorInrDisputes: board.buyerPriorInrDisputes,
      });
    } catch (error) {
      // T003의 예외 문구는 필드 이름만 담는다 (응답 값은 싣지 않는다).
      problems.push({ disputeId: summary.dispute_id, detail: failureLine(error) });
    }
  }

  return { listed: summaries.length, rows, problems };
}

// ── 출력 ───────────────────────────────────────────────────────────────────────

/** 분쟁이 없을 때의 문구 (지시서 문장 그대로). */
export const EMPTY_LINE = '0 disputes (empty list)';

/** 빈 값·빈 목록은 `-`로 적는다 (칸을 비워 두지 않는다). */
const dash = (value: string): string => (value === '' ? '-' : value);

/**
 * 한 건을 한 줄로. 금액은 센트 정수 그대로 적는다 (여기서 계산하지 않는다).
 * 구매자 글은 **개수만** 적는다 (`buyerTexts=1`) — 원문은 어디에도 싣지 않는다.
 */
export function disputeLine(row: DisputeReadRow): string {
  return [
    row.disputeId,
    `reason=${row.reason}`,
    `status=${dash(row.status)}`,
    `stage=${row.stage}`,
    `channel=${row.channel}`,
    `amountCents=${row.amountCents}`,
    `dueDate=${dash(row.dueDate)}`,
    `allowedMoves=${dash(row.allowedMoves.join(','))}`,
    `otherActions=${dash(row.otherActions.join(','))}`,
    `buyerTexts=${row.buyerTextCount}`,
    `buyerPriorInrDisputes=${row.buyerPriorInrDisputes}`,
  ].join(' · ');
}

/** 사람이 읽는 출력 줄들 (`console.log`로 한 줄씩 내보낸다). */
export function disputeReadLines(outcome: DisputeReadOutcome): string[] {
  if (outcome.listed === 0) return [EMPTY_LINE];

  const lines = [`${outcome.listed} disputes`, ...outcome.rows.map(disputeLine)];
  if (outcome.problems.length > 0) {
    lines.push('', '변환하지 못한 분쟁:');
    for (const problem of outcome.problems) lines.push(`- ${problem.disputeId}: ${problem.detail}`);
  }
  lines.push('', TRACKING_NOTE);
  return lines;
}

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;

/** `tests/sandbox/last-run.md`의 "분쟁 읽기" 절. */
export function disputesSection(outcome: DisputeReadOutcome, now: Date = new Date()): string {
  const lines = [
    `- 시각: ${kstStamp(now)}`,
    '- 엔드포인트: GET /v1/customer/disputes → GET /v1/customer/disputes/{id} (조회만)',
    `- 분쟁 ${outcome.listed}건 · 변환 성공 ${outcome.rows.length}건 · 변환 실패 ${outcome.problems.length}건`,
  ];

  if (outcome.listed === 0) {
    lines.push('', EMPTY_LINE);
    return lines.join('\n');
  }

  lines.push(
    '',
    row(['분쟁 ID', 'reason', 'status', '단계', '채널', '금액(센트)', '기한', '허용된 수', '다른 링크', '구매자 글 수', '이전 INR']),
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---']),
    ...outcome.rows.map((r) =>
      row([
        r.disputeId,
        r.reason,
        dash(r.status),
        r.stage,
        r.channel,
        r.amountCents,
        dash(r.dueDate),
        dash(r.allowedMoves.join(',')),
        dash(r.otherActions.join(',')),
        r.buyerTextCount,
        r.buyerPriorInrDisputes,
      ]),
    ),
  );
  if (outcome.problems.length > 0) {
    lines.push('', '### 변환하지 못한 분쟁', ...outcome.problems.map((p) => `- ${p.disputeId}: ${p.detail}`));
  }
  lines.push('', `> ${TRACKING_NOTE}`);
  return lines.join('\n');
}
