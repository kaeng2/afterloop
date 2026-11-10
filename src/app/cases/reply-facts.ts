/**
 * S5 답장의 사실값 한 벌 (T009 2부 재시도, SPEC v2.9 3장 "이름 토큰").
 *
 * 날짜(`replyFacts`) + 이름(`nameFactsPair`, T056). 초안(영어)용과 전송본(구매자 언어)용 두 벌을 만든다 —
 * 토큰 이름은 같고 이름 값의 꼴만 다르다 (설정의 `en` 꼴 / 구매자 언어 꼴 — 한국어 꼴에는 호칭이 이미 들어 있다).
 *
 * 화면을 그릴 때(`view/load.ts`·`reply/load.ts`)와 보낼 때(서버의 `send.ts`) **같은 이 함수**를 부른다.
 * 보내는 쪽은 브라우저에서 사실값을 받지 않고 이 함수로 다시 만든다.
 *
 * 이름 값은 `config/rules.json`의 `reply.names`에서만 온다 (`loadReplyNames`). 이 파일에 이름을 쓰지 않는다.
 * 이름 값은 AI에 가지 않는다 — 프롬프트에는 토큰 이름·종류·뜻만 간다 (T056 `src/ai/prompts/reply.ts`).
 *
 * 순수 코드다 (시각은 입력으로 받는다). 날짜를 만들 수 없거나 이름 설정이 깨졌으면 예외를 던진다 — 부르는
 * 쪽이 "보낼 글 없음"으로 처리한다.
 */
import { loadReplyNames, nameFactsPair } from '@/ai/names';
import type { FactLocale } from '@/ai/tokens';
import { replyFacts } from '@/engine/followup';
import type { FactToken, ReplyNames, SeedBuyer } from '@/types';

const LOCALE: Record<SeedBuyer['language'], FactLocale> = { KO: 'ko', EN: 'en', JA: 'ja', DE: 'de' };

/** 시드 구매자의 언어. 구매자를 모르면 `null`. */
export function buyerLocaleOf(buyer: Pick<SeedBuyer, 'language'> | null): FactLocale | null {
  return buyer === null ? null : LOCALE[buyer.language];
}

export type CaseReplyFacts = {
  /** 영어 초안용 (이름은 `en` 꼴). `draftReply`의 `facts`, 영어 초안 미리보기. */
  draft: FactToken[];
  /** 전송본용 (이름은 구매자 언어 꼴). `translateReply`의 `facts`, 전송본 미리보기, 실제로 보내는 글. */
  outgoing: FactToken[];
};

/**
 * 한 분쟁의 답장 사실값. 순서는 날짜 → 이름 (구매자 이름 → 서명).
 * 구매자 ID는 시드 연결(`LoadedDispute.buyer.id`)에서 온다. 표에 없는 구매자는 서명 토큰만 있다.
 */
export function caseReplyFacts(input: {
  now: string;
  dueDate: string;
  buyerId: string | null;
  buyerLocale: FactLocale;
  names?: ReplyNames;
}): CaseReplyFacts {
  const dates = replyFacts({ now: input.now, disputeDueDate: input.dueDate });
  const pair = nameFactsPair({
    names: input.names ?? loadReplyNames(),
    buyerId: input.buyerId ?? undefined,
    draftLocale: 'en',
    outgoingLocale: input.buyerLocale,
  });
  return { draft: [...dates, ...pair.draft], outgoing: [...dates, ...pair.outgoing] };
}
