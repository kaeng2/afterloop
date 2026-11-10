# T038 보고 (2026-11-10 09:35)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal / `1ccbb3c`

## 결과
완료 — `npm run sandbox:disputes`의 사람용 출력 줄과 `last-run.md` 표 양쪽에 `status`·`buyerTexts`(개수)·`otherActions`(rel 이름) 칸을 더했다. 구매자 글은 `toClassifyInput`(`@/paypal/mapper`)의 결과에서 **개수만** 꺼내 쓰고 변환을 다시 구현하지 않았다. `.env`는 열지 않았고 `npm run sandbox:*`도 실행하지 않았다 (가짜 클라이언트 단위 테스트와 `tests/fixtures/`만 썼다).

구현 메모
- `status`: 분쟁 상세의 `status`를 그대로 옮긴다 (`detail.status?.trim() ?? ''`). 빈 값이면 출력에서 `-`.
- `buyerTexts`: `toClassifyInput(detail, { ...TRACKING_UNKNOWN, buyerPriorInrDisputes, trackingEvents: [] })`의 `buyerMessages.length`. 추적 값은 지금 `toBoardState`에 넘기는 것과 같은 가정(`TRACKING_UNKNOWN` = 둘 다 false)이고 택배사 이벤트는 읽지 않으므로 빈 배열이다. `buyerPriorInrDisputes`는 `toBoardState`에 넘기는 값과 같은 값을 한 번만 세어 두 변환에 같이 넘긴다.
- `otherActions`: `links[].rel` 중 `self`와 `MoveType` 4개(`send_message`·`make_offer`·`provide_evidence`·`accept_claim`)가 아닌 것을 **응답 순서대로** 모아 쉼표로 잇는다. 없으면 `-`. 같은 rel이 두 번 오면 한 번만 적고, 주소(`href`)는 담지 않는다.
- 출력에서 빈 값·빈 목록을 `-`로 바꾸는 일은 `dash()` 한 곳으로 모았다 (줄과 표가 같은 규칙을 쓴다).

fixture로 돌려 본 출력 (구매자 글은 개수만 있다)

```
PP-R-TST-20000002 · reason=MERCHANDISE_OR_SERVICE_NOT_RECEIVED · status=UNDER_REVIEW · stage=CHARGEBACK · channel=INTERNAL · amountCents=7200 · dueDate=- · allowedMoves=- · otherActions=provide_supporting_info · buyerTexts=1 · buyerPriorInrDisputes=0
PP-R-XWI-10197379 · reason=MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED · status=WAITING_FOR_SELLER_RESPONSE · stage=INQUIRY · channel=INTERNAL · amountCents=4800 · dueDate=2026-11-29T06:09:25.608Z · allowedMoves=send_message,make_offer,accept_claim · otherActions=escalate · buyerTexts=1 · buyerPriorInrDisputes=0
```

표 머리글: `| 분쟁 ID | reason | status | 단계 | 채널 | 금액(센트) | 기한 | 허용된 수 | 다른 링크 | 구매자 글 수 | 이전 INR |`

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/sandbox/disputes-read.ts` | `DisputeReadRow`에 `status`·`otherActions`·`buyerTextCount` 추가, `runDisputesRead`가 `toClassifyInput`으로 구매자 글 개수를 센다, `otherActionsOf`·`KNOWN_RELS`·`dash` 추가, `disputeLine`·`disputesSection`에 칸 3개 추가 |
| `tests/unit/sandbox-disputes-read.test.ts` | 실제 응답 fixture 2건으로 새 칸 확인, `status` 없는 경우(`-`)·판매자 글은 세지 않음·중복 rel 확인, 구매자 글 원문이 출력·표에 없음 확인, 기존 행 모양 테스트(줄 문자열·`Object.keys`)를 새 칸에 맞춰 갱신 |

바꾸지 않은 것: `tests/sandbox/manifest.json`, `tests/sandbox/last-run.md` (지시서 3번), `src/`·`config/`·다른 스크립트.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 119 (9 skipped) | 0 | 9건은 실제 샌드박스가 필요해 원래 건너뛰는 것(AC13) |
| npm test | 1020 | 0 | `sandbox-disputes-read.test.ts` 27건 포함 (전에 21건) |
| npx tsc --noEmit | 통과 | 0 | 출력 없음 |
| npm run lint | 통과 | 0 | 출력 없음 |

완료 기준 대조
- [x] `dispute-detail.claim-under-review.json` → `status=UNDER_REVIEW`, `buyerTexts=1`, `otherActions=provide_supporting_info`, `allowedMoves=-`
- [x] `dispute-detail.inquiry-waiting-seller.json` → `buyerTexts=1` (같은 글이 `messages`·`evidences` 양쪽에 있어도 1), `otherActions=escalate`
- [x] 출력·표 어디에도 구매자 글 원문이 없다 (fixture의 글 원문과 그 앞 12자, `@`가 들어간 이메일이 없음을 테스트가 확인)
- [x] 기존 테스트 통과, `npm test`, `npx tsc --noEmit`, `npm run lint`

실제 PayPal 호출은 하지 않았다 — 병합 뒤 컨트롤 타워가 `npm run sandbox:disputes`를 한 번 돌려 `last-run.md`를 새 표로 갱신하면 된다.

## 남은 문제
- `otherActions`의 rel 비교는 대소문자를 구분한다 (`toAllowedMoves`와 같은 규칙). 응답이 `SEND_MESSAGE`처럼 대문자로 오면 `allowedMoves`에 들어가지 않고 `otherActions`에 그 이름이 보인다 — 값을 숨기지 않고 그대로 드러내는 쪽을 골랐다. 지금까지 본 샌드박스 응답은 모두 소문자다.
- 표 칸이 11개로 늘어 좁은 화면에서는 줄이 길다. 데모 때 `last-run.md`를 보여 줄 거라면 칸을 줄일지는 컨트롤 타워 판단이다 (지시서가 요구한 칸은 그대로 둔다).

## 컨트롤 타워에 요청할 결정
- 없음
