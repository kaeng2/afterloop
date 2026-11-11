/** 사건 기록 요약 단위 테스트 (T077). LLM은 전부 가짜 — 네트워크·.env 없음. */
import { describe, expect, it } from 'vitest';

import { summarizeCaseHistory } from '@/ai/history';
import type { CaseEvent, LlmCaller } from '@/types';

const EVENTS: CaseEvent[] = [
  { at: '2026-11-03T09:00:00Z', kind: 'buyer_message', source: 'seed', text: 'Where is my parcel?', flags: ['unanswered'] },
  { at: '2026-11-06T09:00:00Z', kind: 'buyer_message', source: 'seed', text: 'Still nothing, asking again.', flags: ['unanswered'] },
  { at: '2026-11-07T09:00:00Z', kind: 'carrier_event', source: 'seed', text: 'Held at customs, 2 days so far' },
];

const INVALID = { ok: false, reason: 'invalid_output' };
const reply = (summary: unknown): LlmCaller => async () => ({ summary });
const run = (llm: LlmCaller) => summarizeCaseHistory({ events: EVENTS, locale: 'en' }, { llm });

describe('summarizeCaseHistory', () => {
  it('입력 사건 날짜·숫자만 쓰면 ok', async () => {
    const r = await run(
      reply('The buyer asked on Nov 3 and again on Nov 6 with no reply, and the parcel has been held at customs for 2 days.'),
    );
    expect(r.ok).toBe(true);
  });

  it('입력에 없는 날짜·숫자는 invalid_output', async () => {
    expect(await run(reply('Your Nov 5 promise was missed.'))).toEqual(INVALID);
    expect(await run(reply('The buyer asked 5 times.'))).toEqual(INVALID);
    expect(await run(reply('Asked on 11/9 again.'))).toEqual(INVALID);
  });

  it('약속 낱말은 invalid_output', async () => {
    expect(await run(reply('Offer a refund now.'))).toEqual(INVALID);
    expect(await run(reply('You should reship the parcel.'))).toEqual(INVALID);
  });

  it('길이·문장 수·스키마 위반은 invalid_output', async () => {
    expect(await run(reply('a'.repeat(241)))).toEqual(INVALID);
    expect(await run(reply('One. Two. Three.'))).toEqual(INVALID);
    expect(await run(async () => ({ nope: 1 }))).toEqual(INVALID);
  });

  it('꺾쇠는 지우고, 알 수 없는 토큰은 거부', async () => {
    const r = await run(reply('The buyer <b>asked twice</b> with no reply.'));
    expect(r).toEqual({ ok: true, summary: 'The buyer b asked twice /b with no reply.' });
    expect(await run(reply('⟦DATE_1⟧ is the date.'))).toEqual(INVALID);
  });

  it('LLM 예외는 ai_unavailable (던지지 않는다)', async () => {
    const r = await run(async () => {
      throw new Error('boom');
    });
    expect(r).toEqual({ ok: false, reason: 'ai_unavailable' });
  });

  it('같은 입력이면 프롬프트가 같다', async () => {
    const seen: string[] = [];
    const llm: LlmCaller = async (req) => {
      seen.push(req.system + '\n' + req.user);
      return { summary: 'ok.' };
    };
    await run(llm);
    await new Promise((r) => setTimeout(r, 5));
    await run(llm);
    expect(seen[0]).toBe(seen[1]);
  });

  it('이름 값은 보내지 않고 토큰만 보낸다', async () => {
    let user = '';
    const llm: LlmCaller = async (req) => {
      user = req.user;
      return { summary: '⟦BUYER_NAME_1⟧ asked twice.' };
    };
    const r = await summarizeCaseHistory({ events: EVENTS, buyerFirstNameToken: '⟦BUYER_NAME_1⟧', locale: 'en' }, { llm });
    expect(user).toContain('⟦BUYER_NAME_1⟧');
    expect(r.ok).toBe(true);
  });
});
