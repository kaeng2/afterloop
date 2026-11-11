/**
 * T103 단위·정적 테스트: 답장 Send 뒤 목록의 다른 항목을 눌러도 화면이 바뀌지 않던 버그.
 *
 * 원인: Send 뒤 칸(`CaseProgress`)이 `useEffect(() => setTrail(trail), [trail])`로 곡선 상자에 점을 넣는다.
 * 답장 칸(`ReplyPanel`)은 그 상자를 읽으므로 다시 그려지고, 그때마다 `scenarioInput`을 **새 객체**로 넘겼다 →
 * `points`(scenarioRisk) → `trail`이 새 배열 → 또 `setTrail` … 끝없는 기본 우선순위 갱신 (DOM 변화는 0).
 * 이 갱신이 멈추지 않아 목록 링크의 라우터 전환(transition)이 커밋되지 못했다.
 *
 * 막는 것 두 겹: ① 상자가 내용이 같은 배열이면 상태를 바꾸지 않는다(`sameTrail`) ② 답장 칸이 엔진 입력을 useMemo로 고정.
 * 개발 서버·실호출 없음.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { scenarioRisk } from '@/engine/forecast';
import type { BoardState, EscalationSignals } from '@/types';

import { cause } from '../acceptance/boards';

vi.mock('server-only', () => ({}));

const { sameTrail } = await import('@/app/cases/view/draft-forecast');
const model = await import('@/app/cases/progress/progress-model');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const BOARD: BoardState = {
  disputeId: 'PP-R-TEST-D2',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:00:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  hasTracking: true,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo: false,
  cause: cause('A2', 1, 'rule'),
};
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 400,
};
const ANCHOR = 'Hello, your parcel is at customs. I will contact you again by November 17.';
const STEPS = ['sent', 'buyer_reply', 'forwarded', 'cleared'] as const;
const input = () => ({ text: ANCHOR, anchorText: ANCHOR, board: BOARD, signals: SIGNALS, delayDays: 1, translated: true });

describe('T103 sameTrail (곡선 상자 갱신 멈춤)', () => {
  it('내용이 같으면 같다고 본다 (새 배열이어도)', () => {
    expect(sameTrail([], [])).toBe(true);
    expect(sameTrail([0.1, 0.2], [0.1, 0.2])).toBe(true);
    const same = [0.3];
    expect(sameTrail(same, same)).toBe(true);
  });

  it('길이나 값이 다르면 다르다 (단계가 늘면 점이 늘어난다 — T098b 그대로)', () => {
    expect(sameTrail([0.1], [0.1, 0.2])).toBe(false);
    expect(sameTrail([0.1, 0.2], [0.1, 0.25])).toBe(false);
    expect(sameTrail([0.1], [])).toBe(false);
  });

  it('재현: 같은 내용의 새 입력 객체 → 새 점 배열(다른 참조)이지만 sameTrail은 같다 → 상자가 갱신을 멈춘다', () => {
    const state = { shown: 1, typing: true } as const;
    const first = model.riskTrail(state, scenarioRisk(input(), [...STEPS]));
    const again = model.riskTrail(state, scenarioRisk(input(), [...STEPS]));
    expect(first).not.toBe(again); // 이전에는 이 차이만으로 setTrail이 끝없이 돌았다
    expect(first.length).toBeGreaterThan(0);
    expect(sameTrail(first, again)).toBe(true);
  });
});

describe('T103 정적 검사 (루프를 만드는 모양이 돌아오지 않게)', () => {
  it('곡선 상자의 setTrail은 같은 내용이면 이전 상태를 그대로 돌려준다', () => {
    const src = strip(read('src/app/cases/view/draft-forecast.tsx'));
    expect(src).toMatch(/sameTrail\(now, next\) \? now : next/);
    expect(src).toMatch(/const setTrail = useCallback\(/);
  });

  it('답장 칸은 Send 뒤 칸에 엔진 입력을 useMemo 값으로 넘긴다 (렌더마다 새 객체 금지)', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(src).toMatch(/scenarioInput=\{scenarioInput\}/);
    expect(src).toMatch(/const scenarioInput: ScenarioInput \| null = useMemo\(/);
    // CaseProgress 태그 안에 객체 글자로 넘기지 않는다
    const tag = src.slice(src.indexOf('<CaseProgress'), src.indexOf('/>', src.indexOf('<CaseProgress')));
    expect(tag).not.toMatch(/scenarioInput=\{\s*forecastBase/);
  });
});
