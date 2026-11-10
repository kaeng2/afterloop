판정: 통과

# T038 검증 (2026-11-10 09:40 KST)

- 기준 SPEC: `# SPEC v2.2 (2026-11-09 22:31 KST)` — 지시서의 "기준 SPEC v2.2"와 같다.
- 검증 대상: 분리된 HEAD `1e83aa1` (`lane/paypal` 최신), 기준 `main` = `c70f5c5`, merge-base = `b01f4f4`.
- 코드·테스트·문서는 고치지 않았다. `.env`를 찾거나 만들지 않았고 `npm run sandbox:*`는 실행하지 않았다.
- 탐침 스크립트: `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t038-verify/probe.ts` (저장소 밖. 가짜 클라이언트로 `runDisputesRead`·`disputeLine`·`disputeReadLines`·`disputesSection`을 직접 부른다. 검사 36개 모두 OK, 종료 코드 0).

## 근거

### 1. 범위 (`git diff main...HEAD`)
```
A  reports/T038-impl.md                      (+53 −0)
M  scripts/sandbox/disputes-read.ts          (+58 −15)
M  tests/unit/sandbox-disputes-read.test.ts  (+97 −5)
3 files changed, 208 insertions(+), 20 deletions(-)
```
- 수정 가능 폴더 2개와 보고서 1개뿐이다. `git diff main...HEAD --stat -- src tests/sandbox tests/acceptance tests/fixtures config SPEC.md` → 출력 0줄 (변경 없음).
- `git log main..HEAD`에는 6개 커밋이 보이지만(`49f16b5`, 병합 2개, `c7155d3` "T037 막힘", `1ccbb3c`, `1e83aa1`) 세 점 diff에 잡히는 것은 `1ccbb3c`(스크립트·테스트 2파일)와 `1e83aa1`(보고서 1파일)뿐이다.
- merge-base 이후 `main`에 더해진 것은 `c70f5c5` 1개 커밋(`DECISIONS.md`, `reports/STATUS.md`, `reports/sandbox-approve-links.md`)으로, 이 작업이 건드린 파일과 겹치지 않는다.

### 2. 실행 결과
| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm test` | Test Files 18 passed (18) · Tests 1020 passed (1020) | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 출력 없음 (eslint) | 0 |
| `npm run test:acceptance` | Test Files 9 passed (9) · Tests 119 passed, 9 skipped (128) | 0 |
| `npx vitest run tests/unit/sandbox-disputes-read.test.ts` | 27 passed (27) | 0 |

실행 뒤 `git status --short`는 비어 있었다 (이 보고서를 쓰기 전 기준).

### 3. 지시서 "고칠 것" 대조
| 항목 | 결과 | 근거 |
|---|---|---|
| `status` 칸, 없으면 `-` | 충족 | `disputes-read.ts:120` `detail.status?.trim() ?? ''`, 출력에서 `dash()`. 탐침: `status` 키 없음 → `status=-`, 공백만(`'   '`) → `status=-` |
| `buyerTexts=<개수>`는 `toClassifyInput`의 `buyerMessages` 개수 | 충족 | `disputes-read.ts:116,127` — `toClassifyInput(detail, { ...TRACKING_UNKNOWN, buyerPriorInrDisputes, trackingEvents: [] }).buyerMessages.length`. 스크립트 안에 `messages`·`evidences`를 직접 읽는 코드는 없다 (변환을 다시 구현하지 않았다). 탐침에서 같은 fixture를 `toClassifyInput`에 직접 넣은 개수와 일치 |
| 추적 값은 `toBoardState`와 같은 가정, `trackingEvents`는 빈 배열 | 충족 | 두 호출 모두 `...TRACKING_UNKNOWN`, `buyerPriorInrDisputes`도 한 번 센 같은 값 |
| `otherActions` = `self`·`MoveType` 4개가 아닌 rel, 응답 순서, 쉼표, 없으면 `-` | 충족 | `otherActionsOf` (`disputes-read.ts:87-96`). 탐침: `zzz,escalate,send_message,aaa,escalate,self,make_offer,provide_evidence,accept_claim,zzz` → `zzz,escalate,aaa` (순서 유지·중복 1회·4개와 `self` 제외), 같은 응답의 `allowedMoves`는 4개 그대로. `links` 키 없음·`[]`·`self`만 → `otherActions=-` |
| 화면 출력과 `last-run.md` 표 **양쪽** | 충족 | `disputeLine`에 `status=`·`otherActions=`·`buyerTexts=`, `disputesSection` 표에 `status`·`다른 링크`·`구매자 글 수` 칸. 머리글·구분선·모든 행이 11칸으로 같다 (fixture 2건, 5행짜리, 실패가 섞인 경우 모두 확인) |

### 4. 완료 기준 대조 (탐침으로 직접 확인)
- [x] `dispute-detail.claim-under-review.json` →
  `PP-R-TST-20000002 · reason=MERCHANDISE_OR_SERVICE_NOT_RECEIVED · status=UNDER_REVIEW · stage=CHARGEBACK · channel=INTERNAL · amountCents=7200 · dueDate=- · allowedMoves=- · otherActions=provide_supporting_info · buyerTexts=1 · buyerPriorInrDisputes=0`
  표 행: `| PP-R-TST-20000002 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | UNDER_REVIEW | CHARGEBACK | INTERNAL | 7200 | - | - | provide_supporting_info | 1 | 0 |`
- [x] `dispute-detail.inquiry-waiting-seller.json` → `buyerTexts=1` (같은 글이 `messages`와 `evidences`에 있다), `otherActions=escalate` (배열이 `["escalate"]` 하나뿐), `allowedMoves=send_message,make_offer,accept_claim`
- [x] 구매자 글 원문 없음:
  - fixture 2건: 줄 출력 + 표 + `JSON.stringify(outcome)`에 원문 전체·앞 8자·뒤 8자가 없다. `@`도 없다.
  - 표식 `ZZ_MARKER_구매자글`을 `messages[].content`(구매자·판매자)와 `evidences[].notes`(구매자·판매자)에 넣은 정상 경로: 개수 3으로만 나오고 표식은 어디에도 없다.
  - 변환 실패 경로 9종(모르는 단계·채널·통화, 금액 꼴 오류, `content`·`notes`·`rel` 타입 오류, 상세 HTTP 500(본문에 표식), 클라이언트 예외)에서 `problems[].detail`·줄 출력·표 모두에 표식이 없다. 단계·채널·통화·금액 **값 자리에 표식을 넣어도** 문구에는 필드 이름만 나온다. 목록 조회 실패 예외 문구도 `분쟁 목록 조회 실패 (HTTP 500)`뿐이다.
- [x] 기존 테스트 통과, `npm test`·`npx tsc --noEmit`·`npm run lint` — 위 표.

### 5. 기존 동작 유지
- 한 건이 실패해도 나머지를 계속 읽는다: 12건 중 9건이 실패하도록 섞었을 때 성공 3건(`PP-D-10`, `PP-D-19`, `PP-D-21`)·실패 9건, 마지막 건의 상세까지 GET이 나갔다. `toClassifyInput` 호출은 기존 `try` 안에 있어 실패하면 같은 `problems` 경로로 간다.
- 0건 문구 `0 disputes (empty list)` 그대로.
- POST 없음: `scripts/sandbox/disputes-read.ts`·`disputes.ts`에 `client.call`·`.call(`·`POST` 문자열 검색 결과 0건. 탐침의 가짜 클라이언트 `call` 호출 횟수는 모든 경우 0, 기록된 요청은 `GET /v1/customer/disputes?page_size=50`과 `GET /v1/customer/disputes/{id}`뿐.

### 6. 기존 테스트 변경 (`git diff main...HEAD -- tests/unit/sandbox-disputes-read.test.ts`)
- 지워진 줄은 5줄이고 모두 같은 자리에서 더 넓은 내용으로 바뀌었다: `dispute()` 도우미의 `status` 고정값 → 옵션(기본값 같음), 테스트 이름 2개, `moves` 목록(rel 2개 추가), 줄 문자열 기대값(새 칸 3개 포함한 전체 일치).
- `toEqual`(행 전체)·`toBe`(줄 전체)·`Object.keys` 전체 일치는 그대로 전체 일치다. 검사를 지우거나 `toContain` 등으로 약하게 바꾼 곳은 없다.
- 테스트 수: `main`의 같은 파일 23건(`git archive main` 사본에서 실행해 확인) → HEAD 27건 (+4: `status` 없음 1건, fixture 3건).

## 발견한 문제

| # | 심각도 | 내용 |
|---|---|---|
| 1 | 기록만 | **표가 깨지는 입력이 있다 (사실).** `status`나 rel 이름에 `\|`·줄바꿈이 들어오면 그대로 실린다. 탐침: `status='X\|Y\nZ'`, rel `a\|b`·`c\nd` → 표의 그 행이 세 줄로 쪼개지고 칸 수가 11이 아니게 된다. 줄 출력도 4줄이 6줄이 된다. rel에 `,`나 ` · `가 들어오면 구분자와 섞인다. 기존 `reason` 칸도 같은 방식으로 값을 그대로 싣고 있어 새로 생긴 종류의 약점은 아니다. PayPal의 `status`·`rel`은 영문 식별자라 실제로 일어날 가능성은 낮다고 **추측**한다 (돌려 본 샌드박스 응답 fixture 2건의 `status`·`rel`은 모두 영문자와 밑줄뿐이었다). |
| 2 | 기록만 | **구현 보고서의 숫자가 틀리다.** "`sandbox-disputes-read.test.ts` 27건 포함 (전에 21건)" — `main`에서 같은 파일은 23건이다 (늘어난 것은 6건이 아니라 4건). |
| 3 | 기록만 | **구현 보고서의 "중복 rel 확인"에 해당하는 단위 테스트가 없다.** 테스트 파일의 `moves:`는 두 곳(`['send_message','accept_claim','escalate','self','provide_supporting_info']`, `['self','send_message']`)이고 둘 다 중복 rel이 없다. fixture 2건의 `links`에도 중복이 없다. 동작 자체는 탐침에서 맞게 나왔다 (중복 1회만). `links` 키가 아예 없는 경우도 단위 테스트에는 없다 (탐침에서는 `-`). 지시서의 완료 기준에는 없는 항목이라 차단 사유는 아니다. |
| 4 | 기록만 | rel 비교는 대소문자를 구분한다: `SELF`, `Send_Message`는 `otherActions`에 그대로 나온다 (`toAllowedMoves`도 같은 규칙). 구현 보고서 "남은 문제"에 적힌 내용과 실제가 일치한다. |
| 5 | 기록만 | `KNOWN_RELS`(`disputes-read.ts:81`)는 `@/paypal/mapper`의 `MOVE_ORDER`를 손으로 옮긴 사본이다 (`MOVE_ORDER`가 export되지 않고 `src/`는 수정 범위 밖). `MoveType`이 늘면 이 목록도 같이 고쳐야 한다. |
| 6 | 기록만 | 가짜 클라이언트의 `get`이 본문 글이 든 `Error`를 던지면 `failureLine`이 그 문구를 그대로 `problems[].detail`에 옮긴다 (탐침: `boom ZZ_MARKER_구매자글`). 이 diff가 바꾼 부분이 아니고 기존 동작이다. `src/paypal/client.ts`의 `throw` 문구를 검색한 범위에서는 고정 문구와 `debug_id`만 싣고 응답 본문은 싣지 않는 것으로 보인다 (전체를 끝까지 추적하지는 않았다 — 추측). |

병합 차단·병합 후 수정에 해당하는 문제는 없다.

## 구현 보고서 주장 대조
- 사실과 다른 것: 위 2번(전에 21건 → 실제 23건), 3번("중복 rel 확인" 테스트는 없다).
- "브랜치 / 마지막 커밋: `1ccbb3c`" — 코드 커밋은 맞고, 그 뒤에 보고서 커밋 `1e83aa1`이 하나 더 있다 (보고서를 쓴 뒤 커밋했으니 생기는 차이).
- 나머지(구현 메모, fixture 출력 2줄, 표 머리글, 테스트 결과 숫자 1020 / 119+9 skipped / 27, 바꾸지 않은 파일, "남은 문제" 2건)는 직접 확인한 결과와 일치한다.

## 확인하지 못한 것
- 실제 샌드박스에 대한 `npm run sandbox:disputes` 실행과 `tests/sandbox/last-run.md`가 새 표로 써지는지 (지시대로 실행하지 않았다. `writeLastRunSection`은 이 diff에서 바뀌지 않았다).
- 구현 세션이 `.env`를 열지 않았다는 주장과 `npm run sandbox:*`를 돌리지 않았다는 주장 (결과물만 보고는 알 수 없다. `tests/sandbox/last-run.md`·`manifest.json`이 바뀌지 않은 것만 확인했다).
- `dispute-detail.inquiry-under-review-initial.json` fixture는 지시서 완료 기준에 없어 돌려 보지 않았다.
- 11칸 표가 `last-run.md`를 보여 주는 화면에서 읽기 좋은지 (판단 대상이 아니다).
