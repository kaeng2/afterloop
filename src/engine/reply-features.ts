/**
 * 답장 특징 판정 (SPEC v2.11 8-2장, 계약 `DetectReplyFeaturesFn`). 코드 규칙(정규식)만 쓴다 — AI를 부르지 않는다.
 *
 * 기획 시안 v4(`docs/design/mockup-v4/Desk.dc.html`)의 `RX`를 옮겼다. 계약의 `ReplyFeatureKey` 8개만 둔다
 * (환불 약속 특징 backup·noRefund와 promise는 없다 — 사람 결정 2026-11-11).
 *
 * 문장 단위로 찾고, 특징마다 처음 걸린 문장을 `hits`에 넣는다.
 * 시간: 문장 나누기는 글자를 한 번 훑는다. 정규식은 중첩 반복이 없어 문장 길이에 선형이다 → 전체가 글 길이에 선형.
 * `Math.random`·`Date`를 읽지 않는다. 같은 글이면 같은 결과.
 */
import type { DetectReplyFeaturesFn, ReplyFeatureHits, ReplyFeatureKey, ReplyFeatures } from '@/types';

/** 특징 순서 (계약 `ReplyFeatureKey`와 같은 8개). */
export const REPLY_FEATURE_KEYS: readonly ReplyFeatureKey[] = [
  'apology',
  'cause',
  'ask',
  'date',
  'lang',
  'blame',
  'vague',
  'refundNow',
];

const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/** `lang`을 뺀 7개 특징의 규칙 (lang은 글자 종류로 따로 본다). */
const RX: Record<Exclude<ReplyFeatureKey, 'lang'>, RegExp> = {
  apology: /sorry|apolog|죄송|미안|사과\s?드/i,
  cause: /customs|clearance|colou?r|\bsize\b|세관|통관|색상|사이즈/i,
  ask: /customs (?:id|code)|pccc|send (?:me|us) (?:your|the)|reply with|please (?:send|share|provide)|통관번호|고유부호|알려\s?주|보내\s?주/i,
  // 영어 월 이름 + 날짜("November 17", "Nov. 17", "17 November"), "11월 17일", "11/17"
  date: new RegExp(
    `\\b${MONTH}\\.?\\s{0,3}\\d{1,2}(?!\\d)|\\b\\d{1,2}(?:st|nd|rd|th)?\\s{1,3}(?:of\\s{1,3})?${MONTH}\\b|\\d{1,2}월\\s{0,3}\\d{1,2}일|\\d{1,2}일\\s{0,3}까지|\\b\\d{1,2}\\/\\d{1,2}(?!\\d)`,
    'i',
  ),
  blame:
    /not (?:our|my) (?:fault|responsibility|problem)|your (?:fault|problem)|contact customs yourself|(?:저희|제|판매자) ?(?:책임|잘못)(?:이|은|도)? ?아(?:니|닙)|(?:택배사|배송사|세관|고객님) ?(?:의 )?(?:잘못|탓)|직접 (?:세관|택배사|문의)|세관에 직접/i,
  vague: /\bsoon\b|should arrive|eventually|any day|곧|조만간|언젠가|금방 ?(?:도착|갈|가)/i,
  refundNow:
    /(?:have|i['’]ve|already) refunded|refunded (?:the|your)|(?:issued|processed) (?:a|the|your) (?:full )?refund|환불(?:해)? ?드렸|환불했어요|환불 완료|환불 처리했/i,
};

/** ask 보조 규칙: 통관번호류 낱말과 요청 동사가 한 문장에 함께 있으면 참 (따로 훑으므로 선형). */
const ASK_TOPIC = /개인통관고유부호|통관번호|통관부호/;
const ASK_VERB = /알려|보내|회신/;

/** 구매자 언어 글자: 한글·가나 (영어 초안은 보낼 때 번역되므로 화면이 `translated`로 알려 준다). */
const BUYER_SCRIPT = /[가-힣぀-ヿ]/;

/** 마침표 뒤에서 문장을 끊지 않는 약어 ("Nov. 17"이 두 문장으로 갈리지 않게). */
const ABBREVIATIONS = new Set([
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'mr', 'mrs', 'ms', 'dr',
]);

const TERMINATORS = new Set(['.', '!', '?', '。']);

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === ' ';
}

/** 마침표 앞 단어가 약어인지 (뒤로 최대 5글자만 본다 → 상수 시간). */
function endsWithAbbreviation(text: string, dotIndex: number): boolean {
  let start = dotIndex;
  while (start > 0 && dotIndex - start < 5 && /[A-Za-z]/.test(text[start - 1])) start -= 1;
  if (start > 0 && /[A-Za-z]/.test(text[start - 1])) return false;
  return ABBREVIATIONS.has(text.slice(start, dotIndex).toLowerCase());
}

/**
 * 문장 나누기 (한 번 훑기). 줄바꿈, 또는 [.!?。] 뒤에 공백·끝이 오면 끊는다. 약어 뒤 마침표는 끊지 않는다.
 * 빈 문장은 버리고 앞뒤 공백은 잘라 낸다.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const push = (end: number) => {
    const s = text.slice(start, end).trim();
    if (s) out.push(s);
    start = end;
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') {
      push(i);
      start = i + 1;
      continue;
    }
    if (!TERMINATORS.has(ch)) continue;
    const next = text[i + 1];
    if (next !== undefined && !isSpace(next) && next !== '\n') continue;
    if (ch === '.' && endsWithAbbreviation(text, i)) continue;
    push(i + 1);
  }
  push(text.length);
  return out;
}

/** 특징 없음 (빈 글 = 답장 안 함). */
export function noReplyFeatures(): ReplyFeatures {
  return Object.fromEntries(REPLY_FEATURE_KEYS.map((k) => [k, false])) as ReplyFeatures;
}

/**
 * 답장 특징. 계약 밖 선택 인자 `opts.translated`: 글이 보낼 때 구매자 언어로 번역되면 화면이 `true`를 넘긴다.
 *
 * `lang` 판단 규칙: 글이 비어 있지 않고, (글에 한글·가나가 있거나 `translated === true`)이면 참.
 * hits.lang은 구매자 언어 글자가 있는 첫 문장 (번역으로 참이 됐으면 첫 문장).
 */
export const detectReplyFeatures = ((text: string, opts?: { translated?: boolean }) => {
  const features = noReplyFeatures();
  const hits: ReplyFeatureHits = {};
  if (typeof text !== 'string' || text.trim() === '') return { features, hits };

  const sentences = splitSentences(text);
  for (const key of Object.keys(RX) as (keyof typeof RX)[]) {
    const rx = RX[key];
    const hit = sentences.find((s) => rx.test(s) || (key === 'ask' && ASK_TOPIC.test(s) && ASK_VERB.test(s)));
    if (hit !== undefined) {
      features[key] = true;
      hits[key] = hit;
    }
  }

  const scriptHit = sentences.find((s) => BUYER_SCRIPT.test(s));
  if (scriptHit !== undefined || opts?.translated === true) {
    features.lang = true;
    hits.lang = scriptHit ?? sentences[0];
  }
  return { features, hits };
}) satisfies DetectReplyFeaturesFn;
