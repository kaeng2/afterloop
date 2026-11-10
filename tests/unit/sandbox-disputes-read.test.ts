/**
 * 단위 테스트: `npm run sandbox:disputes`의 분쟁 읽기와 `setup -- disputes`의 manifest 덧붙이기 (T029).
 * 가짜 PayPal 클라이언트로만 돈다 — 실제 샌드박스를 부르지 않는다.
 *
 * 확인하는 것
 *  - `runDisputesRead`: 목록 → 건별 상세 → `toBoardState`, 조회(GET)만 보낸다
 *  - 0건이면 "0 disputes (empty list)"와 종료할 거리가 없음(문제 0건)
 *  - `status`·`buyerTexts`(개수)·`otherActions`(rel 이름) 칸 (T038) — 실제 응답 fixture로 본다
 *  - 변환하지 못한 분쟁: ID와 **필드 이름만** 적고 나머지는 계속 읽는다
 *  - 출력·`last-run.md` 절에 구매자 이름·이메일·주소·메시지 원문·payer_id·비밀값이 없다
 *  - `mergeDisputes`·`missingDisputeKeys`: 한 건만 찾아도 이미 적힌 분쟁이 지워지지 않는다
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_LINE,
  TRACKING_NOTE,
  disputeLine,
  disputeReadLines,
  disputesSection,
  runDisputesRead,
} from '../../scripts/sandbox/disputes-read';
import { writeLastRunSection } from '../../scripts/sandbox/last-run';
import { DISPUTE_ORDER_KEY, mergeDisputes, missingDisputeKeys, runDisputes } from '../../scripts/sandbox/setup-steps';
import type { Manifest, ManifestDispute } from '../../scripts/sandbox/manifest';
import type { ApiRequest, PayPalClient } from '@/types';

type Seen = { method: 'GET' | 'POST'; path: string };
type Reply = { status: number; body?: unknown };

/** 경로로 답을 고르는 가짜 클라이언트. 모르는 경로는 404. */
function fakeClient(replies: Record<string, Reply | (() => Reply)>): { client: PayPalClient; seen: Seen[] } {
  const seen: Seen[] = [];
  const answer = (key: string): Reply => {
    const reply = replies[key];
    if (reply === undefined) return { status: 404, body: { name: 'NOT_FOUND' } };
    return typeof reply === 'function' ? reply() : reply;
  };
  const client: PayPalClient = {
    get: async (p: string) => {
      seen.push({ method: 'GET', path: p });
      const { status, body = {} } = answer(`GET ${p}`);
      return { status, body };
    },
    call: async (req: ApiRequest) => {
      seen.push({ method: 'POST', path: req.path });
      const { status, body = {} } = answer(`POST ${req.path}`);
      return { status, body };
    },
  };
  return { client, seen };
}

const LIST_PATH = 'GET /v1/customer/disputes?page_size=50';
const detailPath = (disputeId: string): string => `GET /v1/customer/disputes/${disputeId}`;

const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const SNAD = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';

/** 분쟁 1건 (목록 항목과 상세가 같은 꼴을 쓴다). */
const dispute = (
  disputeId: string,
  options: {
    reason?: string;
    /** `''`를 주면 응답에 `status` 키가 아예 없는 분쟁이 된다 (출력은 `-`) */
    status?: string;
    stage?: string;
    channel?: string;
    value?: string;
    currency?: string;
    sellerDue?: string;
    buyerDue?: string;
    payerId?: string;
    moves?: string[];
    messages?: { posted_by: string; content: string }[];
  } = {},
) => ({
  dispute_id: disputeId,
  reason: options.reason ?? INR,
  ...(options.status === '' ? {} : { status: options.status ?? 'WAITING_FOR_SELLER_RESPONSE' }),
  dispute_life_cycle_stage: options.stage ?? 'INQUIRY',
  dispute_channel: options.channel ?? 'INTERNAL',
  dispute_amount: { currency_code: options.currency ?? 'USD', value: options.value ?? '48.00' },
  ...(options.sellerDue === undefined ? {} : { seller_response_due_date: options.sellerDue }),
  ...(options.buyerDue === undefined ? {} : { buyer_response_due_date: options.buyerDue }),
  disputed_transactions: [
    {
      seller_transaction_id: 'CAP-1',
      buyer: { payer_id: options.payerId ?? 'PAYERX' },
      // 구매자 이름·이메일이 섞여 오더라도 T003의 스키마가 떼낸다
      seller: { name: 'Fernwood Knits' },
    },
  ],
  links: (options.moves ?? ['send_message', 'make_offer', 'self']).map((rel) => ({
    rel,
    href: `https://api-m.sandbox.paypal.com/v1/customer/disputes/${disputeId}`,
    method: 'POST',
  })),
  ...(options.messages === undefined ? {} : { messages: options.messages }),
});

const D1 = 'PP-D-11110001';
const D2 = 'PP-D-11110002';
const D3 = 'PP-D-11110003';

describe('runDisputesRead (분쟁 목록 읽기)', () => {
  it('분쟁이 0건이면 빈 목록을 확인하고 문제로 보지 않는다', async () => {
    const { client, seen } = fakeClient({ [LIST_PATH]: { status: 200, body: { items: [], links: [] } } });

    const outcome = await runDisputesRead(client);

    expect(outcome).toEqual({ listed: 0, rows: [], problems: [] });
    expect(disputeReadLines(outcome)).toEqual([EMPTY_LINE]);
    expect(seen).toEqual([{ method: 'GET', path: '/v1/customer/disputes?page_size=50' }]);
  });

  it('목록 1회 + 건별 상세만 GET으로 부른다 (POST 0회)', async () => {
    const { client, seen } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1), dispute(D2)], links: [] } },
      [detailPath(D1)]: { status: 200, body: dispute(D1) },
      [detailPath(D2)]: { status: 200, body: dispute(D2) },
    });

    const outcome = await runDisputesRead(client);

    expect(outcome.listed).toBe(2);
    expect(outcome.problems).toEqual([]);
    expect(seen.map((s) => s.method)).toEqual(['GET', 'GET', 'GET']);
    expect(seen.slice(1).map((s) => s.path)).toEqual([`/v1/customer/disputes/${D1}`, `/v1/customer/disputes/${D2}`]);
  });

  it('건마다 분쟁 ID·reason·status·단계·채널·금액(센트)·기한·허용된 수·다른 링크·구매자 글 수를 모은다', async () => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1)], links: [] } },
      [detailPath(D1)]: {
        status: 200,
        body: dispute(D1, {
          reason: SNAD,
          status: 'UNDER_REVIEW',
          stage: 'CHARGEBACK',
          channel: 'EXTERNAL',
          value: '72.50',
          sellerDue: '2026-11-16T00:00:00.000Z',
          moves: ['send_message', 'accept_claim', 'escalate', 'self', 'provide_supporting_info'],
          messages: [
            { posted_by: 'BUYER', content: '아직 못 받았어요' },
            { posted_by: 'SELLER', content: '확인 중입니다' },
            { posted_by: 'BUYER', content: '언제 오나요' },
          ],
        }),
      },
    });

    const { rows } = await runDisputesRead(client);

    expect(rows).toEqual([
      {
        disputeId: D1,
        reason: SNAD,
        status: 'UNDER_REVIEW',
        stage: 'CHARGEBACK',
        channel: 'EXTERNAL',
        amountCents: 7250,
        dueDate: '2026-11-16T00:00:00.000Z',
        allowedMoves: ['send_message', 'accept_claim'],
        otherActions: ['escalate', 'provide_supporting_info'], // `self`와 수 4개는 뺀다 (응답 순서)
        buyerTextCount: 2, // 판매자 글은 세지 않는다
        buyerPriorInrDisputes: 0,
      },
    ]);
    expect(disputeLine(rows[0])).toBe(
      `${D1} · reason=${SNAD} · status=UNDER_REVIEW · stage=CHARGEBACK · channel=EXTERNAL · amountCents=7250 · dueDate=2026-11-16T00:00:00.000Z · allowedMoves=send_message,accept_claim · otherActions=escalate,provide_supporting_info · buyerTexts=2 · buyerPriorInrDisputes=0`,
    );
  });

  it('status가 없거나 다른 링크·구매자 글이 없으면 `-`·0으로 적는다 (칸을 비워 두지 않는다)', async () => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1)], links: [] } },
      [detailPath(D1)]: { status: 200, body: dispute(D1, { status: '', moves: ['self', 'send_message'] }) },
    });

    const { rows } = await runDisputesRead(client);

    expect([rows[0].status, rows[0].otherActions, rows[0].buyerTextCount]).toEqual(['', [], 0]);
    const line = disputeLine(rows[0]);
    expect(line).toContain('status=-');
    expect(line).toContain('otherActions=-');
    expect(line).toContain('buyerTexts=0');
    expect(disputesSection({ listed: 1, rows, problems: [] })).toContain(`| ${D1} | ${INR} | - | INQUIRY |`);
  });

  it('판매자 기한이 없으면 구매자 기한을 쓰고, 둘 다 없으면 빈 값으로 둔다 (날짜를 지어내지 않는다)', async () => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1), dispute(D2)], links: [] } },
      [detailPath(D1)]: { status: 200, body: dispute(D1, { buyerDue: '2026-11-20T00:00:00.000Z' }) },
      [detailPath(D2)]: { status: 200, body: dispute(D2) },
    });

    const { rows } = await runDisputesRead(client);

    expect(rows.map((r) => r.dueDate)).toEqual(['2026-11-20T00:00:00.000Z', '']);
    expect(disputeLine(rows[1])).toContain('dueDate=-');
  });

  it('같은 구매자의 이전 INR 분쟁 수를 목록에서 센다 (이번 건과 다른 구매자는 세지 않는다)', async () => {
    const items = [
      dispute(D1, { reason: INR, payerId: 'PAYER-M' }),
      dispute(D2, { reason: INR, payerId: 'PAYER-M' }),
      dispute(D3, { reason: SNAD, payerId: 'PAYER-OTHER' }),
    ];
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items, links: [] } },
      [detailPath(D1)]: { status: 200, body: items[0] },
      [detailPath(D2)]: { status: 200, body: items[1] },
      [detailPath(D3)]: { status: 200, body: items[2] },
    });

    const { rows } = await runDisputesRead(client);

    expect(rows.map((r) => [r.disputeId, r.buyerPriorInrDisputes])).toEqual([
      [D1, 1],
      [D2, 1],
      [D3, 0],
    ]);
  });

  it('추적 기록은 주문 상세에서 오는 값이라 false로 두고 그 사실을 출력에 적는다', async () => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1)], links: [] } },
      [detailPath(D1)]: { status: 200, body: dispute(D1) },
    });

    const outcome = await runDisputesRead(client);

    expect(disputeReadLines(outcome)).toContain(TRACKING_NOTE);
    expect(disputesSection(outcome)).toContain('sandbox:check');
  });
});

describe('변환하지 못한 분쟁', () => {
  const broken = {
    '모르는 단계': { body: dispute(D2, { stage: 'MEDIATION' }), field: /dispute_life_cycle_stage/ },
    '모르는 채널': { body: dispute(D2, { channel: 'PHONE' }), field: /dispute_channel/ },
    'USD가 아닌 통화': { body: dispute(D2, { currency: 'KRW' }), field: /dispute_amount\.currency_code/ },
    '금액 꼴이 아님': { body: dispute(D2, { value: '48,00' }), field: /dispute_amount\.value/ },
  };

  for (const [label, { body, field }] of Object.entries(broken)) {
    it(`${label}: 그 건의 ID와 문제 필드를 적고 나머지는 계속 읽는다 (종료 코드 1)`, async () => {
      const { client } = fakeClient({
        [LIST_PATH]: { status: 200, body: { items: [dispute(D1), dispute(D2), dispute(D3)], links: [] } },
        [detailPath(D1)]: { status: 200, body: dispute(D1) },
        [detailPath(D2)]: { status: 200, body },
        [detailPath(D3)]: { status: 200, body: dispute(D3) },
      });

      const outcome = await runDisputesRead(client);

      expect(outcome.listed).toBe(3);
      expect(outcome.rows.map((r) => r.disputeId)).toEqual([D1, D3]);
      expect(outcome.problems).toHaveLength(1);
      expect(outcome.problems[0].disputeId).toBe(D2);
      expect(outcome.problems[0].detail).toMatch(field);
      expect(disputeReadLines(outcome).join('\n')).toContain(`- ${D2}:`);
    });
  }

  it('문제 문구에 응답 값은 싣지 않는다 (필드 이름만)', async () => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1)], links: [] } },
      [detailPath(D1)]: { status: 200, body: dispute(D1, { stage: 'MEDIATION', currency: 'KRW' }) },
    });

    const { problems } = await runDisputesRead(client);

    expect(problems[0].detail).not.toContain('MEDIATION');
    expect(problems[0].detail).not.toContain('KRW');
  });

  it('상세 조회가 실패하면 그 건을 문제로 적고 나머지는 계속 읽는다', async () => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1), dispute(D2)], links: [] } },
      [detailPath(D1)]: { status: 403, body: { name: 'NOT_AUTHORIZED' } },
      [detailPath(D2)]: { status: 200, body: dispute(D2) },
    });

    const outcome = await runDisputesRead(client);

    expect(outcome.rows.map((r) => r.disputeId)).toEqual([D2]);
    expect(outcome.problems[0]).toEqual({ disputeId: D1, detail: '분쟁 상세 조회 실패 (HTTP 403)' });
  });

  it('목록 조회가 실패하면 던진다 (건별 상세는 부르지 않는다)', async () => {
    const { client, seen } = fakeClient({ [LIST_PATH]: { status: 403, body: { name: 'NOT_AUTHORIZED' } } });

    await expect(runDisputesRead(client)).rejects.toThrow(/분쟁 목록 조회 실패 \(HTTP 403\)/);
    expect(seen).toHaveLength(1);
  });
});

describe('출력에 개인정보·비밀값이 없다', () => {
  const withPersonalData = () =>
    fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1, { payerId: 'PAYER-SECRET1' })], links: [] } },
      [detailPath(D1)]: {
        status: 200,
        body: {
          ...dispute(D1, { payerId: 'PAYER-SECRET1' }),
          messages: [{ posted_by: 'BUYER', content: '아직 못 받았어요. 제 번호는 010-1234-5678입니다.' }],
          buyer: { name: { alternate_full_name: 'Mike Morgan' }, email: 'buyer@example.test' },
        },
      },
    }).client;

  it('사람용 출력에 이름·이메일·메시지 원문·payer_id가 없다', async () => {
    const outcome = await runDisputesRead(withPersonalData());
    const text = disputeReadLines(outcome).join('\n');

    expect(text).not.toContain('Mike Morgan');
    expect(text).not.toContain('@');
    expect(text).not.toContain('010-1234-5678');
    expect(text).not.toContain('아직 못 받았어요');
    expect(text).not.toContain('PAYER-SECRET1');
  });

  it('`last-run.md` 절에도 없다 (그리고 토큰·Secret 꼴이 없다)', async () => {
    const outcome = await runDisputesRead(withPersonalData());
    const section = disputesSection(outcome, new Date('2026-11-09T14:30:00Z'));

    expect(section).toContain('2026-11-09 23:30 KST');
    expect(section).toContain(D1);
    expect(section).not.toContain('Mike Morgan');
    expect(section).not.toContain('@');
    expect(section).not.toContain('PAYER-SECRET1');
    expect(section).not.toMatch(/access_token|client_secret|authorization/i);
    expect(section).not.toMatch(/Bearer\s|Basic\s/i);
  });

  it('출력에 쓰는 칸만 돌려준다 (받은 응답을 그대로 끌고 오지 않는다)', async () => {
    const { rows } = await runDisputesRead(withPersonalData());

    expect(Object.keys(rows[0]).sort()).toEqual([
      'allowedMoves',
      'amountCents',
      'buyerPriorInrDisputes',
      'buyerTextCount',
      'channel',
      'dueDate',
      'disputeId',
      'otherActions',
      'reason',
      'stage',
      'status',
    ].sort());
    expect(rows[0].buyerTextCount).toBe(1); // 글은 셌지만 원문은 담지 않는다
  });
});

/** 실제 샌드박스 응답을 담아 둔 fixture. 구매자 글 원문을 테스트 파일에 베끼지 않고 여기서 읽는다 */
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, `../fixtures/${name}`), 'utf8')) as Record<string, unknown>;

const CLAIM_FIXTURE = 'dispute-detail.claim-under-review.json';
const WAITING_FIXTURE = 'dispute-detail.inquiry-waiting-seller.json';

describe('status·buyerTexts·otherActions (실제 응답 fixture, T038)', () => {
  /** 그 한 건만 든 목록 → 같은 몸통을 상세로 돌려준다 */
  const readOne = async (detail: Record<string, unknown>): ReturnType<typeof runDisputesRead> => {
    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [detail], links: [] } },
      [detailPath(detail.dispute_id as string)]: { status: 200, body: detail },
    });
    return runDisputesRead(client);
  };

  it('검토 중인 CHARGEBACK(`messages` 키가 없는 건): status·글 1건·provide_supporting_info·허용된 수 없음', async () => {
    const { rows } = await readOne(fixture(CLAIM_FIXTURE));

    expect([rows[0].status, rows[0].buyerTextCount, rows[0].otherActions, rows[0].allowedMoves]).toEqual([
      'UNDER_REVIEW',
      1,
      ['provide_supporting_info'],
      [],
    ]);
    const line = disputeLine(rows[0]);
    expect(line).toContain('status=UNDER_REVIEW');
    expect(line).toContain('buyerTexts=1');
    expect(line).toContain('otherActions=provide_supporting_info');
    expect(line).toContain('allowedMoves=-');
  });

  it('판매자 응답 대기: 같은 글이 `messages`와 `evidences`에 있어도 1건, 다른 링크는 escalate뿐', async () => {
    const { rows } = await readOne(fixture(WAITING_FIXTURE));

    expect(rows[0].buyerTextCount).toBe(1);
    expect(rows[0].otherActions).toEqual(['escalate']);
    expect(rows[0].allowedMoves).toEqual(['send_message', 'make_offer', 'accept_claim']);
    expect(disputeLine(rows[0])).toContain('otherActions=escalate');
  });

  it('출력·표 어디에도 구매자 글 원문이 없다 (개수만 적는다)', async () => {
    for (const name of [CLAIM_FIXTURE, WAITING_FIXTURE]) {
      const detail = fixture(name);
      const note = (detail.evidences as { notes: string }[])[0].notes;
      const outcome = await readOne(detail);
      const text = [
        disputeReadLines(outcome).join('\n'),
        disputesSection(outcome, new Date('2026-11-09T14:30:00Z')),
      ].join('\n');

      expect(text).toContain('buyerTexts=1');
      expect(text).not.toContain(note);
      expect(text).not.toContain(note.slice(0, 12)); // 글 앞부분도 새어 나오지 않는다
      expect(text).not.toContain('@'); // 구매자·판매자 이메일
    }
  });
});

describe('last-run.md "분쟁 읽기" 절', () => {
  it('다른 절(조회·요청 ID)은 그대로 두고 분쟁 절만 덮어쓴다', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'afterloop-lastrun-'));
    mkdirSync(path.join(root, 'tests/sandbox'), { recursive: true });
    const file = path.join(root, 'tests/sandbox/last-run.md');

    writeLastRunSection('check', '- 시각: 2026-11-09 23:01 KST\n- 토큰 발급: 성공', root);
    writeLastRunSection('probe', '- 61자 ID 201', root);

    const { client } = fakeClient({
      [LIST_PATH]: { status: 200, body: { items: [dispute(D1)], links: [] } },
      [detailPath(D1)]: { status: 200, body: dispute(D1) },
    });
    const outcome = await runDisputesRead(client);

    writeLastRunSection('disputes', disputesSection(outcome, new Date('2026-11-09T14:30:00Z')), root);
    writeLastRunSection('disputes', disputesSection({ listed: 0, rows: [], problems: [] }, new Date('2026-11-09T15:00:00Z')), root);

    const text = readFileSync(file, 'utf8');
    expect(text).toContain('## 조회 (`npm run sandbox:check`)');
    expect(text).toContain('- 토큰 발급: 성공');
    expect(text).toContain('- 61자 ID 201');
    expect(text).toContain('## 분쟁 읽기 (`npm run sandbox:disputes`)');
    expect(text).toContain(EMPTY_LINE);
    expect(text).not.toContain(D1); // 분쟁 절은 덮어써졌다
    expect(text.match(/## 분쟁 읽기/g)).toHaveLength(1);
  });

  it('커밋된 `tests/sandbox/last-run.md`의 기존 절을 읽어도 모양이 깨지지 않는다', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'afterloop-lastrun2-'));
    mkdirSync(path.join(root, 'tests/sandbox'), { recursive: true });
    const committed = readFileSync(path.join(__dirname, '../../tests/sandbox/last-run.md'), 'utf8');
    writeFileSync(path.join(root, 'tests/sandbox/last-run.md'), committed, 'utf8');

    writeLastRunSection('disputes', disputesSection({ listed: 0, rows: [], problems: [] }), root);

    const text = readFileSync(path.join(root, 'tests/sandbox/last-run.md'), 'utf8');
    expect(text.split('<!-- afterloop:last-run:')).toHaveLength(4); // 머리글 + 절 3개
    expect(text).toContain('| GET /v1/customer/disputes | 200 | ok |'); // 기존 조회 절
    expect(text).toContain('| 61자 (1회차) | 61 | 201 |'); // 기존 요청 ID 절
  });
});

describe('mergeDisputes (setup -- disputes 다시 실행, T001 검증 1번)', () => {
  const d = (key: string, disputeId: string): ManifestDispute => ({ key, disputeId, orderKey: DISPUTE_ORDER_KEY[key] });

  it('한 건만 찾아도 이미 적힌 분쟁은 지워지지 않는다', () => {
    const existing = [d('D1', 'PP-A-1'), d('D2', 'PP-A-2'), d('D3', 'PP-A-3')];

    expect(mergeDisputes(existing, [d('D1', 'PP-A-1'), d('D3', 'PP-A-3')])).toEqual(existing);
    expect(missingDisputeKeys(mergeDisputes(existing, []))).toEqual([]);
  });

  it('같은 키는 새로 찾은 ID로 갱신하고 새 키는 더한다 (키 순서로 적는다)', () => {
    const merged = mergeDisputes([d('D2', 'PP-OLD-2')], [d('D3', 'PP-A-3'), d('D2', 'PP-NEW-2'), d('D1', 'PP-A-1')]);

    expect(merged.map((m) => [m.key, m.disputeId])).toEqual([
      ['D1', 'PP-A-1'],
      ['D2', 'PP-NEW-2'],
      ['D3', 'PP-A-3'],
    ]);
  });

  it('D1~D3 가운데 모자란 키를 알려 준다', () => {
    expect(missingDisputeKeys([])).toEqual(['D1', 'D2', 'D3']);
    expect(missingDisputeKeys([d('D2', 'PP-A-2')])).toEqual(['D1', 'D3']);
    expect(missingDisputeKeys([d('D1', 'PP-A-1'), d('D2', 'PP-A-2'), d('D3', 'PP-A-3')])).toEqual([]);
  });

  it('원래 배열을 고치지 않는다', () => {
    const existing = [d('D1', 'PP-A-1')];
    mergeDisputes(existing, [d('D2', 'PP-A-2')]);
    expect(existing).toHaveLength(1);
  });

  /**
   * T001 검증 보고서의 S10c: 분쟁 3건이 적힌 상태에서 D2 조회만 5xx일 때
   * 전에 적어 둔 D2가 manifest에서 지워지던 문제. `runDisputes` + `mergeDisputes`를 이어 돌려 본다.
   */
  it('D2 조회만 실패해도 전에 적어 둔 D2가 남는다 (S10c)', async () => {
    const manifest: Manifest = {
      orders: [
        { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true, captureId: 'CAP-O01' },
        { key: 'O02', orderId: 'ORDER-O02', buyer: 'jiho', sku: 'FK-CD-OAT', tracked: false, captureId: 'CAP-O02' },
        { key: 'O08', orderId: 'ORDER-O08', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: true, captureId: 'CAP-O08' },
      ],
      disputes: [d('D1', 'PP-A-1'), d('D2', 'PP-A-2'), d('D3', 'PP-A-3')],
    };
    const listFor = (captureId: string): string =>
      `GET /v1/customer/disputes?disputed_transaction_id=${captureId}&page_size=10`;
    const { client, seen } = fakeClient({
      // D1 → O02, D2 → O01, D3 → O08 (DISPUTE_ORDER_KEY)
      [listFor('CAP-O02')]: { status: 200, body: { items: [{ dispute_id: 'PP-A-1' }] } },
      [listFor('CAP-O01')]: { status: 503, body: { name: 'INTERNAL_SERVICE_ERROR' } },
      [listFor('CAP-O08')]: { status: 200, body: { items: [{ dispute_id: 'PP-A-3' }] } },
    });

    const { outcomes, disputes } = await runDisputes(client, manifest);
    const merged = mergeDisputes(manifest.disputes, disputes);

    expect(disputes.map((x) => x.key)).toEqual(['D1', 'D3']); // 이번에 찾은 것은 2건
    expect(outcomes.find((o) => o.key === 'D2')?.status).toBe(503);
    expect(merged).toEqual(manifest.disputes); // 3건 그대로
    expect(missingDisputeKeys(merged)).toEqual([]);
    expect(seen.every((s) => s.method === 'GET')).toBe(true); // 조회만
  });
});
