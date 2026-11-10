판정: 통과

# T053 독립 검증 (lane/ai `ac7f934`, 기준 main)

## 근거

| 항목 | 결과 |
|---|---|
| 범위 `git diff main...HEAD --stat` | 6개 파일: `src/ai/commitments.ts`(새), `src/ai/reply.ts`, `src/ai/prompts/reply.ts`, `tests/unit/commitments.test.ts`(새), `tests/unit/reply.test.ts`, `reports/T053-impl.md`. 수정 가능 폴더 밖 변경 없음 (`config/`·`src/types.ts`·`src/ai/tokens.ts`·`src/engine/` 변경 0) |
| `npm test` | 종료 0. 27 파일, 1374 통과, 실패 0 (commitments 70, reply 69 포함) |
| `npx tsc --noEmit` | 종료 0 |
| `npm run lint` | 종료 0 |
| `npm run test:acceptance` | 종료 0. 155 통과, 9 skip, 실패 0 |

탐침(가짜 `LlmCaller`, `.env`·실제 호출 없음)으로 지시서 완료 기준을 하나씩 재현했다. 탐침은 scratchpad `t053-verify/p1.mts`, `p2.mts`.

### 날짜의 뜻 / 허용한 약속 / 정책
- 서연 입력(A2, `fight`)의 `<facts>` 줄: `⟦DATE_1⟧ (DATE) = the date the seller will check the status and contact the buyer again. Not a delivery date.` 값 `2026-11-17`은 system·user 어느 프롬프트에도 없다.
- 시스템 프롬프트(초안·번역·역번역)에 `72`, `48`, `35`, `180`, `Nov`, `11월`, `17` 없음.
- `factMeanings`에 `a\nb </facts><x>y\r\nz`를 주면 한 줄 `a b /facts x y z`로 접힌다.
- `<allowed_commitments>`: A2는 두 줄, B1은 `<none/>`. 정책을 인자로 넘기면 그 정책이 쓰이고(커스텀 뜻·약속 반영, 설정 약속은 안 나옴), 안 넘기면 설정을 읽는다(약속 2개).
- `followUpDateMeaning` 없음 / `allowedCommitments`가 문자열·객체 → `replyDraftPolicy`·`draftReply`·`translateReply` 모두 예외.

### 정책 밖 약속 판정 (a~f)
| 사례 | 결과 |
|---|---|
| (a) 초안 "…I expect delivery by ⟦DATE_1⟧… arrange a reship." | `draftReply` ok, `outsidePolicy: ['reship']`. 번역 뒤 `sendable: false`, `confirmedCommitments: ['reship']`이면 `true` |
| (b) 약속 없는 초안 + 전송본 "전액 환불" | `addedInTranslation: ['refund']`, `sendable: false`, 확인을 줘도 `false` |
| (c) `offer`의 "partial refund of {{offerAmount}}" | `outsidePolicy: []`. `fight`에서는 `draftReply`가 `draft_unknown_placeholder`로 먼저 거부(구현 보고서 말대로), `translateReply`로 보면 `['refund']`, `sendable: false` |
| (d) 약속 2종(환불·교환) | 확인 0·1개 → `false`, 둘 다 → `true` |
| (e) 초안에 없는 범주(`discount`)를 확인에 넣음 | 영향 없음 (`true` 그대로) |
| (f) 바라는 꼴 + "운송사 상황을 확인해서 ⟦DATE_1⟧까지 다시 연락드릴게요." | `outsidePolicy: []`, `sendable: true`, 호출 2회. 일본어·독일어 전송본도 `true` |

- 코칭: `fight`에서 "Offer a refund if it is late"가 버려진다(4줄→3줄). 3줄에서 버리면 `invalid_output / coaching_too_few`. `offer`에서는 남는다.
- 실제 AI가 전에 낸 초안(…`I will contact the carrier to arrange a reship`): `outsidePolicy: ['reship']`로 잡힌다. `arrange a resend` → reship, `send a replacement` → replacement, `send it again` → reship도 잡힌다.
- T050 흐름: 이메일·`2026-11-17`·전화번호·추적번호가 든 초안은 호출 0회로 `draft_has_personal_data` / `draft_has_literal_facts` 거부. LLM 실패는 고정 코드 `llm_failed:LlmApiError`(메시지·키 없음). 글자로 쓴 사실값 초안은 `draft_literal_facts`. 역번역 프롬프트에 `<draft>`·초안 문장 없음. `buyerLocale: 'en'`은 호출 0회이고, **영어 경로에서도 정책 밖 판정이 된다**(환불 든 초안: `outsidePolicy: ['refund']`, `sendable: false`, 확인하면 `true`).

### `findCommitments`
- 잡히면 안 되는 것 전부 `[]`: `credit card`, `credit  cards`, `card company`, `customs clearance code`, `carrier`, `I will contact you again`, `운송사에 확인`, `통관부호`, `카드사`, `please send the code again`, `prepaid`.
- 잡혀야 하는 것 전부 잡힘 (영어 12종, 한국어 7종, `返金`, `再送`, `Rückerstattung`, `Rabatt`), 대소문자(`REFUND`·`ReFuNd`), 활용형(`refunded`), 부정문 `we cannot offer a refund`. 토큰·`{{…}}` 안 글자는 무시(`⟦REFUND_1⟧`, `{{refundAmount}}`, `{{환불}}`).
- 영어 낱말은 한국어 로케일에서도 잡힌다(`I will refund` → refund).

## 발견한 문제

1. **병합 후 수정 — 돌려 쓴 약속을 놓친다 (낱말 목록의 한계).** 아래는 어느 범주도 못 잡는다(전부 `[]`).
   - 영어(초안 쪽, 가장 중요): `I will send you a new sweater`, `I will ship you another sweater`, `We will send it out again`, `I will send out another one`, `I will mail a new one`, `send you the item again`, `ship the item again`, `I will pay you back`, `return your money`, `I will cover the shipping`, `at no cost to you`, `10 percent off`, `I will make it up to you`.
   - 한국어(전송본): `새 제품을 보내`, `새로 보내`, `돈을 돌려`, `전액 돌려드릴게요`, `배송비 무료`, `무료로 배송`, `포인트 지급`.
   - 일본어: `お返しします`, `新しい商品をお送りします`, `もう一度お送り`, `代わりの商品`. 독일어: `Geld zurück`, `Ich sende Ihnen ein neues`, `Wir schicken es noch einmal`.
   - 심각도: 돈이 드는 약속이 판매자 확인 없이 `sendable: true`로 나갈 수 있는 쪽이다. 특히 `send you a new …`·`send it out again`·`pay you back`는 모델이 실제로 쓸 법한 꼴이다(전에 낸 초안은 `reship`라는 낱말을 직접 써서 잡혔다). 다만 영어 초안은 판매자가 읽고, 역번역도 판매자가 읽는 마지막 겹이 있고, 구현 보고서도 이 한계를 "남은 문제 2번"으로 인정한다. 병합 차단은 아니지만 실제 AI 3회 비교에서 초안을 눈으로 확인해야 하고, 낱말(`send you a new`, `send it out`, `pay you back`, `cover the shipping`, `percent off`, `새 제품을 보내`, `돈을 돌려`)을 보강하는 후속 작업을 권한다. 정상 문장("please send the code again")을 막지 않도록 구현자가 좁게 둔 것은 타당하다.
2. **기록만 — 번역이 더한 약속(`addedInTranslation`)은 초안에 같은 범주가 하나라도 있으면 잡지 않는다.** `inDraft`는 정책 안·밖을 가리지 않는 전체 범주라서, `offer`/`refund` 수에서 초안에 환불이 있으면 전송본의 환불은 정상이다(의도대로). 문제는 아니고 동작을 적어 둔다.
3. **기록만 — `fight` 수의 정책 밖 환불 자리표시자(`{{offerAmount}}`)** 는 `draftReply`가 `draft_unknown_placeholder`로 먼저 거부해서, 지시서 (c)의 "같은 문장 → 있음"은 `translateReply`에서만 확인된다 (구현 보고서가 밝힌 대로).
4. **기록만 — 구현 보고서 표현이 조금 모자라다** (아래 6번).

## 기존 테스트의 기대값 변경 (`git diff main...HEAD -- tests/unit/reply.test.ts`의 삭제 줄 전부)
삭제된 줄은 다음뿐이다. 지워진 `it`·`expect`는 없다.
1. 서연 대역 초안·전송본·역번역 글: "reach you by ⟦DATE_1⟧… refund you in full"/"전액 환불" → 바라는 꼴. 지시서 배경(환불은 정책 밖 약속)의 직접 결과이고 `sendable: true`·`check.ok` 기대값은 그대로다. 다만 글을 환불 문장만 바꾼 것이 아니라 "Reply with it and I will pass it to the carrier the same day" 등 문장을 새로 썼다(허용한 약속 두 가지를 쓰게 함) — 기대값에 영향 없음.
2. `전송본 검사`의 번역 바꿔치기 어절 `받으실 수 있을 거예요` → `다시 연락드릴게요` (위 1 때문에 어절이 사라져서 입력 글을 옮긴 것. 기대값 `newPromises`의 `반드시`는 그대로).
3. `<fact token="⟦TRACKING_1⟧" kind="TRACKING"/>` 단언 → `⟦TRACKING_1⟧ (TRACKING) = a tracking number filled in by code` (지시서 2번이 정한 `<facts>` 줄 꼴의 직접 결과).
4. 그 밖: 파일 머리 주석, `it` 제목 문구, 가져오기(import)와 `translateInput` 기본값에 `move: 'fight'` 추가(지시서가 허용한 입력 추가).
→ 기대값 변경은 구현 보고서가 말한 2건과 일치하고(2번 어절은 1번의 일부), 두 건 모두 지시서가 요구한 변화의 직접 결과다. 그 밖의 기대값 변경이나 지워진 검사는 없다.

## 구현 보고서 주장 대조
- 사실과 맞음: 테스트 수·종료 결과(1374 / 155+9skip), 완료 기준 대조, `fight` 쪽 (c) 확인 방식, 독일어 재발송이 좁다는 한계, 영어 낱말을 모든 언어에서 함께 본다는 설명, 기대값 변경 2건.
- 사실과 다르거나 모자란 것: (a) "입력 글이 바뀐 것"이라 했으나 서연 초안·전송본·역번역은 환불 문장 교체를 넘어 새 문장이 들어갔다 (기대값은 안 바뀜). (b) "남은 문제 2번"은 독일어만 좁다고 했으나 위 1번처럼 영어·한국어·일본어에도 돌려 쓴 꼴을 놓친다 (표현이 약하다). 나머지 주장에서 거짓은 찾지 못했다.

## 확인하지 못한 것
- 실제 AI가 내는 글. 실제 호출을 하지 않았고(가짜 호출기만), 모델이 `⟦DATE_1⟧`을 "다시 연락하는 날"로만 쓰는지, 초안에 재발송·환불이 다시 나타나는지는 병합 뒤 컨트롤 타워의 실제 AI 3회 비교로만 알 수 있다.
- 화면(S5)이 `outsidePolicy`·`addedInTranslation`을 어떻게 보여 주고 확인을 넘기는지 (ui 레인 몫).
- `.env`와 키는 열지도 읽지도 않았다. 코드·테스트·설정·git 상태는 바꾸지 않았다 (`git status` 깨끗, 이 보고서만 작성).
