# T020 보고 (2026-11-10 13:37)

- 기준 SPEC: v2.8 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `SPEC v2.8 (2026-11-10 12:58 KST)`)
- 브랜치 / 마지막 커밋: lane/ai / `0a4faf0` (구현) + 이 보고서 커밋
- 실제 AI 호출: 없음. `.env`를 열지 않았다. 단위 테스트는 가짜 `LlmCaller`만 쓴다

## 결과

완료. `writeColorNote(input, { llm })`는 구매자 글에서 공통 색상 불만을 찾아 EN·KO·JA·DE 문구와 역번역(KO·JA·DE → EN)을 만든다.
판정은 모두 코드가 한다. **컨트롤 타워 결정 3에 따라 기본 문구는 만들지 않았다**: 실패하면 `ok: false` + 고정 사유 코드를 돌려주고, S2는 그 자리를 숨긴다.

## 지시서와 다르게 한 것 (결정 3 반영)

지시서 본문의 `ColorNote`(`source: 'ai' | 'default'`, `failure?`)는 기본 문구를 전제로 한 모양이다. 결정 3("`ok: false`(고정 사유 코드)를 돌려준다")에 맞춰 반환 타입을 아래로 바꿨다. 실패 코드 목록(`ColorNoteFailure`)은 지시서 그대로다.

```ts
type ColorNote =
  | { ok: true; finding: string; notes: Record<'en'|'ko'|'ja'|'de', { text: string; backTranslationEn: string | null }> }
  | { ok: false; reason: ColorNoteFailure; detail: string };   // detail = ColorNoteDetail 고정 코드(여럿이면 ',')
```

- `detail` 예: `llm_failed:LlmApiError`, `llm_refused`, `output_schema`, `note_ko:digits`, `back_de:commitment`. 구매자 글·문구·오류 메시지는 싣지 않는다 (`src/ai/reply.ts`와 같은 방식). 타입으로 목록을 고정했다.
- 기본 문구 상수와 그 테스트는 만들지 않았다. 그래서 "한국어 기본 문구 검수 필요" 항목은 **해당 없음**이다.
- 지시서 완료 기준의 "→ 기본 문구"는 테스트에서 "→ `ok: false` + 해당 `reason`"으로 확인했다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `src/ai/color-note.ts` (새 파일) | 타입(`ColorNoteInput`·`ColorNote`·`ColorNoteFailure`·`ColorNoteDetail` 등), `writeColorNote`, 판정 함수 `colorTextProblems`. 호출 1(문구) → 검사 → 호출 2(역번역) → 역번역 검사. 예외를 던지지 않는다 (맨 바깥에도 `try`). `console.*` 없음 |
| `src/ai/prompts/color-note.ts` (새 파일) | `WRITE_SYSTEM`·`BACK_TRANSLATE_SYSTEM`(고정 문자열), 응답 JSON 스키마 둘, `buildWriteUser`(`<product>`·`<known_facts>`·`<buyer_messages>`), `buildBackTranslateUser`(`<notes>`에 KO·JA·DE만). 모든 입력은 `sanitizeUntrusted` → 상한에서 자르기 → `maskTruncatedPccc`. 상한: 글 10개 × 500자, 상품 이름 80, 설명 600, 사실 10줄 × 160 |
| `tests/unit/color-note.test.ts` (새 파일) | 64개 (아래 대조표) |

`src/ai/reply.ts`·`tokens.ts`·`commitments.ts`·`llm.ts`·`prompts/reply.ts`·`prompts/classify.ts`는 읽고 그대로 썼다 (수정 없음).

## 코드가 하는 검사

네 문구 + `finding` (역번역 호출 **전**. 걸리면 역번역을 부르지 않는다 → 호출 1회):

| 검사 | 방법 |
|---|---|
| 숫자 | `/\p{Nd}/u` — 반각·전각·그 밖의 십진 숫자 전부 |
| 토큰·자리표시자 | `⟦`·`⟧`·`{{`·`}}` 글자, `checkTokens('', 글, [])`의 `extra`·`literalFacts`, 그리고 지시서대로 `checkTokens(영어, 번역, [])`가 `ok`가 아니면 거부 |
| 확언 | `checkTokens('', 글, [])`의 `newPromises` — **빈 초안과 견준다.** `checkTokens(영어, 번역)`만 쓰면 영어에 "guarantee"가 있을 때 번역의 "보장"이 같은 묶음이라 통과하고, 영어 자체의 확언은 아예 안 잡힌다. 단독 비교로 이 구멍을 막았다 (테스트 있음) |
| 돈이 드는 약속 | `findCommitments(글, locale)`가 비어 있지 않으면 거부 (허용 약속 없음) |
| 효과 주장·분쟁 이야기 | `color-note.ts`의 `EFFECT_TERMS` (분쟁·반품·불만·클레임, "줄어/fewer/reduce/減ら/reduzier" 등, 언어별) |
| 길이·모양 | 비었으면 `empty`, 문구 280자·`finding` 200자 초과면 `too_long`, 3문장 이상이면 `too_many_sentences` (`.!?。！？`로 셈) |
| 개인정보 | `maskPersonal(글) !== 글`이면 거부. `⟦PCCC⟧` 같은 가림 표식은 토큰 검사에도 걸린다 |

역번역 셋 (호출 2 뒤): 비었으면 거부 + 위 검사를 **영어 목록으로** 한 번 더 한다(문장 수 제외). 한국어·일본어·독일어 낱말 목록이 놓친 약속·숫자가 영어로 드러나면 잡힌다.

## 화면(S2)이 부르는 방법

1. S2 서버 액션이 [Write the note]에서 `writeColorNote({ productName, complaints: [...시드 B1 문의 original, 지호 분쟁 글], productDescription?, knownFacts? }, { llm: getLlm() })`를 부른다 (`getLlm()`은 `src/app/_server/llm.ts`).
2. `ok: true`면 한국어 `notes.ko.text`를 가장 크게, 펼침에 EN·JA·DE 문구와 `backTranslationEn`을 보이고 'AI suggests' 배지를 붙인다. `finding`은 판매자용 한 줄이다.
3. `ok: false`면 색상 문구 자리를 숨긴다 (T013 규칙 4, 결정 3). `reason`·`detail`은 화면에 보이지 않아도 된다 (고정 코드라 서버 로그에 남겨도 안전하다).
4. 이 결과는 시뮬레이션·`color_note` 처방 토글과 무관하다. 엔진에 넘기지 않는다.
5. 호출 비용: 성공 2회, 검사 실패·색상 아님 1회, 글 없음 0회.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 155 (+ 9 skip) | 0 | 실행만 했다 |
| `npm test` | 1631 | 0 | `tests/unit/color-note.test.ts` 64 |
| `npx tsc --noEmit` | — | 0 | |
| `npm run lint` | — | 0 | |

## 완료 기준 대조

| 기준 | 결과 |
|---|---|
| 정상(한국어 2 + 영어 1): 네 언어, 영어 역번역 null, 나머지 문자열, 호출 2회 | 통과 |
| 숫자(`30% 더 회색`, `3 days`, 전각 `１`·`２`) → `check_failed` | 통과 (`finding`·역번역 숫자도) |
| `⟦DATE_1⟧`·`{{offerAmount}}`·`⟦TRACKING⟧`·`{{ x }}` → 실패 | 통과 |
| 약속 "환불해 드려요" / "we will refund" / "お返しします" / "Rückerstattung" (+ free shipping) → 실패 | 통과 (역번역에서 드러난 약속도) |
| 효과·단정 "분쟁이 줄어요" / "100% 같은 색" / "보장" / guarantee / fewer returns / 必ず / 返品 / garantieren / Reklamation → 실패 | 통과 |
| `color_issue_found: false` → `no_color_issue`, 호출 1회 | 통과 |
| 1번·2번 호출 던짐, 거부, 스키마 불일치, 빈 문자열·null 응답 → 예외 없이 `ok: false`, 고정 코드, 구매자 글 없음 | 통과 (오류 메시지에 구매자 글을 넣은 경우도) |
| 구매자 글 없음(`[]`, 공백만) → 호출 0회, `no_complaints` | 통과 |
| 주입 문장은 `<buyer_messages>` 안에만, 시스템 프롬프트에 없음, 닫는 태그 무력화 | 통과 |
| 이메일·전화·`P123456789012`가 system·user에 그대로 없음 (설명·사실 칸 포함, 잘린 끝 포함) | 통과 |
| 역번역 호출의 system·user에 영어 문구·`finding`(·구매자 글) 없음 | 통과 |
| 기본 문구 상수 검사 | **해당 없음** (결정 3) |
| 결과 JSON에 수치 필드 없음 (모델이 `reduction` 등을 섞어도 zod가 버림), 키는 `ok`·`finding`·`notes` / `ok`·`reason`·`detail` | 통과 |

## 남은 문제

1. **돌려 쓴 표현은 코드가 못 막는다** (T053 보고와 같은 한계). "안심하고 고르실 수 있어요", "이제 걱정 없이 주문하세요", "photos show the true color"처럼 낱말 목록에 없는 효과 주장·확인되지 않은 사실은 통과할 수 있다. 숫자를 낱말로 쓴 것("three days", "세 번")도 `checkTokens`의 `literalFacts`가 잡는 꼴만 막힌다. 프롬프트가 금지하고, 마지막 겹은 판매자가 읽는 것이다. 역번역을 영어 목록으로 한 번 더 보는 것이 겹을 하나 더한다.
2. **효과 낱말 목록은 막는 쪽으로 틀린다.** "return", "분쟁", "Rückgabe" 같은 화제 낱말이 있으면 문구 전체를 버린다. 반대로 `vermeiden`·`prevent`·`예방`은 자연스러운 안내문("놀라지 않으시도록")을 막을 수 있어 넣지 않았다.
3. **문장 수 세기는 단순하다.** `.!?。！？`로 자른다. 독일어 "z. B."나 영어 약어가 들어가면 문장으로 더 세어 거부될 수 있다 (막는 쪽).
4. **실제 AI 시험 때 볼 것:** `src/ai/llm.ts`의 `LLM_MAX_TOKENS = 1024`, 기본 effort `low`. 네 언어 문구 + finding은 보통 들어가지만, 잘리면 `LlmResponseError` → `ai_unavailable`이 된다. 또 모델이 문구 끝에 "!"를 더 붙이거나 세 문장을 쓰면 `check_failed`가 된다. 실패하면 `detail`의 코드로 원인을 바로 볼 수 있다.
5. 검수: 일본어·독일어 문구는 AI가 매번 새로 쓰므로 고정 문구 검수는 없다. 데모 전 실제 AI 시험 결과의 한국어·일본어·독일어 문구는 사람이 한 번 읽는 것을 권한다.

## 컨트롤 타워에 요청할 결정

- 반환 타입을 결정 3에 맞춰 `ok: true | false`로 바꿨다 (위 "지시서와 다르게 한 것"). 이 모양으로 확정해 T013 후속(색상 문구 연결) 지시서에 적어 주기를 요청한다. 계약 파일(`src/types.ts`)에는 넣지 않았다.
- 그 밖에 없음.
