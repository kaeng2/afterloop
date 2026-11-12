/**
 * 시안 맞추기 B — "누르면 일어나는 일"의 순수 함수 (T091, SPEC v2.15 8-4장, 시안 `Desk.dc.html` `typeOut`·`paths`·`lints`).
 * 브라우저 묶음에도 들어간다. **숫자를 만들지 않는다** — 칩 %p는 엔진 `replyFeatureEffects`의 `deltaPp`를 표기만 바꾸고,
 * 글 바꾸기는 엔진의 `appendSentence`·`removeSentence`를 그대로 쓴다 (엔진이 %p를 구한 것과 같은 글이 되게).
 *
 * 넣는 문장은 `config/reply-snippets.json`(엔진 `replySnippetsFor`)만. 자리표시자(⟦BUYER_NAME_1⟧·⟦DATE_1⟧)는
 * 화면의 토큰 채움(`screenText`, 영어 초안과 같은 길)으로 채운다. 채우지 못한 문장은 칩에 내지 않는다.
 */
import { appendSentence, removeSentence } from '@/engine/forecast';
import type { Evaluation, FactToken, ReplyFeatureEffect, ReplyFeatureKey } from '@/types';

import { screenText } from './reply-model';

// ───────────────────────────── 선택지 카드 → 초안 ─────────────────────────────

export type DeskPath = Evaluation['move'] | 'custom';

/** 수마다 넣을 초안 글. 없으면 그 수는 글을 바꾸지 않는다 (`null`). */
export type MoveDrafts = Partial<Record<Evaluation['move'], string | null>>;

/**
 * 선택지 카드를 누르면 입력칸에 들어갈 글 (시안 `pick: typeOut(paths[k].draft)`). 새 AI 호출을 만들지 않는다:
 * 그 수의 초안이 있으면 그 글, 없으면 지금 글 그대로 (`null` → 바꾸지 않음).
 */
export function draftForMove(move: Evaluation['move'], drafts: MoveDrafts): string | null {
  const text = drafts[move];
  return typeof text === 'string' && text.trim() !== '' ? text : null;
}

/**
 * 환불 카드를 고른 상태에서 예측할 글 (컨트롤 타워 결정 2026-11-12): 큰 위험 %·반응 막대 = 카드에 보인 숫자
 * (엔진 `forecastMoves`의 refund = AI 초안 특징 + refundNow). 특징은 문장마다 판정해 합치므로, AI 초안 끝에 환불 안내 글의
 * refundNow 문장을 넣은 글을 엔진 `forecastReply`에 넘기면 그 수의 엔진 값이 나온다. 숫자를 만들지 않는다 (글만 고른다).
 * 문장이 없으면 `null` (지금 글 그대로 예측).
 */
export function refundMoveText(anchor: string, refundNowSentence: string | null | undefined): string | null {
  if (typeof refundNowSentence !== 'string' || refundNowSentence.trim() === '') return null;
  return appendSentence(anchor, refundNowSentence);
}

// ───────────────────────────── 타이핑 효과 ─────────────────────────────

/** 다음에 보일 글자 수 (시안 `i = Math.min(text.length, i + 2)`). */
export function nextTyped(shown: number, total: number, step: number): number {
  return Math.min(total, shown + step);
}

/** 타이핑 효과의 단계마다 보일 글 (시안 그대로 — 처음은 빈 글, 마지막은 전체). 움직임 줄이기면 전체 한 단계. */
export function typeOutFrames(text: string, step: number, reduced: boolean): string[] {
  if (reduced || text.length === 0) return [text];
  const frames: string[] = [];
  let shown = 0;
  while (shown < text.length) {
    shown = nextTyped(shown, text.length, step);
    frames.push(text.slice(0, shown));
  }
  return frames;
}

// ───────────────────────────── 칩 (Missing + Add · ! Remove · ✓) ─────────────────────────────

/** 넣을 문장의 자리표시자를 채운다 (영어 초안과 같은 토큰 채움). 채우지 못하면 그 문장은 뺀다. */
export function filledSnippets(
  snippets: Partial<Record<ReplyFeatureKey, string>>,
  facts: FactToken[],
): Partial<Record<ReplyFeatureKey, string>> {
  const out: Partial<Record<ReplyFeatureKey, string>> = {};
  for (const [key, sentence] of Object.entries(snippets) as [ReplyFeatureKey, string | undefined][]) {
    if (typeof sentence !== 'string' || sentence.trim() === '') continue;
    const filled = screenText(sentence, facts, 'en', null);
    if (filled.filled) out[key] = filled.text;
  }
  return out;
}

export type EffectRowView = {
  key: ReplyFeatureKey;
  kind: ReplyFeatureEffect['kind'];
  labelKey: string;
  /** good·bad: 걸린 문장, missing: 넣을 문장. */
  sentence: string | null;
  /** 엔진 `deltaPp`를 정수로 반올림한 표기 ("−12", "+3", "0"). bad 줄은 시안 부호 (`shownDeltaPp`). */
  pp: string;
  /** 누르면 하는 일. good은 없음. */
  action: 'add' | 'remove' | null;
};

export type EffectRows = { bad: EffectRowView[]; missing: EffectRowView[]; good: EffectRowView[] };

/** %p 표기 (시안 `effTxt`: 양수 '+', 음수 '−', 0은 부호 없음). 값은 엔진 값을 반올림만 한다. */
export function ppText(deltaPp: number): string {
  const n = Math.round(deltaPp);
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
}

/**
 * 칩 줄에 보일 %p (T104 F4-47, 시안 `eff(k, present)`). 시안 부호 규칙 = "이 문장이 위험을 얼마나 바꾸나":
 *  - good: p(지금) − p(그 문장 없음) → 음수 (엔진 `deltaPp`와 같은 정의)
 *  - missing: p(넣은 글) − p(지금) → 음수 (엔진과 같은 정의)
 *  - bad: p(지금) − p(그 문장 뺀 글) → **양수** "+N pts" (엔진 `deltaPp` = p(뺀 글) − p(지금)의 부호만 뒤집는다)
 * 엔진 정의는 그대로 두고 표시 부호만 바꾼다 (계산 아님).
 */
export function shownDeltaPp(effect: Pick<ReplyFeatureEffect, 'kind' | 'deltaPp'>): number {
  return effect.kind === 'bad' ? -effect.deltaPp : effect.deltaPp;
}

/**
 * 엔진 효과 → 칩 줄. 순서 (시안 `lints`): 나쁜 것 → 빠진 것(효과 큰 것부터, 시안 `sort((a,b)=>a.e-b.e)`) → 좋은 것.
 * 환불 완료 글(`refundNow`)이면 빠진 것을 내지 않는다 (시안 `if (!f.refundNow)`).
 */
export function effectRows(effects: readonly ReplyFeatureEffect[] | null, refundNow: boolean): EffectRows | null {
  if (effects === null) return null;
  const row = (effect: ReplyFeatureEffect): EffectRowView => ({
    key: effect.key,
    kind: effect.kind,
    labelKey: `case.feature.${effect.key}`,
    sentence: effect.sentence,
    pp: ppText(shownDeltaPp(effect)),
    action: effect.kind === 'missing' ? 'add' : effect.kind === 'bad' && effect.sentence !== null ? 'remove' : null,
  });
  const missing = refundNow
    ? []
    : effects
        .filter((effect) => effect.kind === 'missing')
        .slice()
        .sort((a, b) => a.deltaPp - b.deltaPp)
        .map(row);
  return {
    bad: effects.filter((effect) => effect.kind === 'bad').map(row),
    missing,
    good: effects.filter((effect) => effect.kind === 'good').map(row),
  };
}

/** 칩 버튼 → 새 글 (Add = 글 끝에 그 문장, Remove = 그 문장 삭제). 엔진이 %p를 구할 때와 같은 함수다. */
export function applyChip(
  text: string,
  row: Pick<EffectRowView, 'action' | 'sentence'> & { key?: ReplyFeatureKey },
  hitsOf?: (text: string) => Partial<Record<ReplyFeatureKey, string>> | null,
): string {
  if (row.sentence === null || row.action === null) return text;
  if (row.action === 'add') return appendSentence(text, row.sentence);
  let out = removeSentence(text, row.sentence);
  // T116 F4-46: 시안처럼 그 규칙에 걸리는 문장을 **모두** 뺀다. 엔진 `removeSentence`(하나)를 반복하고,
  // 다음 문장은 같은 엔진 규칙(특징 판정의 hit)으로만 찾는다. 새 규칙을 만들지 않는다. 글이 줄지 않으면 멈춘다
  if (row.key === undefined || hitsOf === undefined) return out;
  for (let guard = 0; guard < 50; guard += 1) {
    const next = hitsOf(out)?.[row.key];
    if (typeof next !== 'string' || next === '') break;
    const cut = removeSentence(out, next);
    if (cut === out) break;
    out = cut;
  }
  return out;
}

/** 걸린 문장 줄임 (시안 `cut`: 40자 넘으면 39자 + …, 따옴표). 글자 표기만. */
export function quoteCut(sentence: string | null, max = 40): string {
  const text = sentence ?? '';
  return `“${text.length > max ? `${text.slice(0, max - 1)}…` : text}”`;
}

/** "N to fix · N missing · N good" 요약 (0인 것은 뺀다, 시안 `lintSum`). */
export function lintSummary(rows: EffectRows): { key: string; count: number }[] {
  return [
    { key: 'case.reply.sumFix', count: rows.bad.length },
    { key: 'case.reply.sumMiss', count: rows.missing.length },
    { key: 'case.reply.goodCount', count: rows.good.length },
  ].filter((item) => item.count > 0);
}
