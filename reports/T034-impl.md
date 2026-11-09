# T034 보고 (2026-11-10 17:30)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal / `8b8eb03`
- 실제 PayPal 호출: **0회.** `npm run sandbox:*`를 한 번도 실행하지 않았다. 돌린 것은 `npm test`,
  `npx vitest run`, `npx tsc --noEmit`, `npm run test:acceptance`, `npm run lint`, `git`뿐이다.
- `.env`: 열거나 출력하지 않았다.

## 결과
완료 — `buildOrderBody`가 `payment_source.paypal.experience_context`(`return_url`·`cancel_url`·
`user_action: 'PAY_NOW'`, `shipping_preference` 없음)를 보낸다. 승인 링크 `rel` 고르기(네 경우)와
"샌드박스 도메인 검사 대상은 응답의 승인 링크뿐"이라는 점, `PAYER_ACTION_REQUIRED`가 네 곳에서
"승인 전"으로 다뤄지는 점을 단위 테스트로 고정했다. 캡처 스크립트는 읽기만 했고 고칠 것이 없었다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/create-sandbox-orders.ts` | `RETURN_URL`·`CANCEL_URL` 상수 + `EXPERIENCE_CONTEXT` 추가, `buildOrderBody`에 `payment_source.paypal.experience_context` 한 줄, `renderApproveLinks` 안내에 "승인하면 …`/afterloop/return?...`으로 넘어간다" 한 줄, 주석 3곳(파일 머리말, `approveUrlKind`, `approveUrlFrom`) |
| `tests/unit/sandbox-orders.test.ts` | 본문 기대값 갱신 + `experience_context` 12건 확인, 승인 링크 `rel` 네 경우, `example.com`이어도 멈추지 않음, `PAYER_ACTION_REQUIRED` 응답 처리, 안내 한 줄 확인 (+14건) |
| `tests/unit/sandbox-orders-protect.test.ts` | 캡처가 `PAYER_ACTION_REQUIRED`를 승인 전으로 보는지, 생성 모드가 `PAYER_ACTION_REQUIRED`·`payer-action` 응답으로 manifest·링크 파일 12건을 정상 기록하는지 (+2건) |

바꾸지 않은 것 (요청대로 0줄): `tests/sandbox/manifest.json`, `reports/sandbox-approve-links.md`,
`reports/sandbox-capture-first-run.md`, `scripts/capture-sandbox-orders.ts`(읽기만), `src/`,
`tests/acceptance/`, `seed/`, `config/`, `package.json`.

`git diff --stat`(커밋 전) = 위 3개 파일만: `278 insertions(+), 10 deletions(-)`.

### 고친 것 (지시서 "고칠 것" 1~5번 대조)
| # | 지시 | 한 것 |
|---|---|---|
| 1 | `experience_context` 추가 | `return_url: https://example.com/afterloop/return`, `cancel_url: https://example.com/afterloop/cancel`, `user_action: 'PAY_NOW'`. 두 주소는 `RETURN_URL`·`CANCEL_URL` 상수. `shipping_preference`는 넣지 않았다 (주석에 이유: 배송 추적·미수령 분쟁에 배송지가 필요). 그 밖의 본문(`intent`, `purchase_units`, 상품명, 금액, `item_total`)은 그대로 — 테스트로 따로 확인 |
| 2 | 승인 링크 `rel` | `approveUrlFrom`이 이미 `approve` → 없으면 `payer-action`을 고른다 (고칠 것 없음). 네 경우(둘 다 / `approve`만 / `payer-action`만 / 없음) + `rel` 대소문자를 테스트로 고정 |
| 3 | 기존 안전장치 유지 | 코드 변경 없음. 검사 대상이 **응답의 승인 링크**뿐이라는 것을 `approveUrlKind` 주석에 적고, 본문에 `example.com`이 들어간 채로 12건을 끝까지 만드는 테스트와 `payer-action` 링크가 live면 멈추는 테스트를 추가. T030 보호(캡처·승인된 주문 보존, `--` 빠진 옵션 차단)는 기존 테스트 그대로 통과 |
| 4 | `PAYER_ACTION_REQUIRED` 해석 | `--fresh`는 `RECREATE_STATUSES`에 이미 있다 (T030). `--status`는 상태를 그대로 옮긴다. 캡처 스크립트는 `orderStatus !== 'APPROVED'`면 `not approved yet`이므로 올바르게 승인 전으로 다룬다 — **읽기만 했고 문제 없었다.** 캡처 쪽 동작을 테스트로 고정 |
| 5 | 링크 파일 안내 한 줄 | `renderApproveLinks`의 안내(표 위)에 ``승인하면 `https://example.com/afterloop/return?...`으로 넘어간다. 그 화면이 뜨면 승인이 끝난 것이다.`` 추가. 코드만 바꿨고 저장소의 링크 파일은 쓰지 않았다 — 다음에 스크립트가 파일을 쓸 때 들어간다 |

### 기대값을 바꾼 기존 테스트 (완료 기준 5·지시서 요구)
| 테스트 | 왜 |
|---|---|
| `buildOrderBody › intent CAPTURE · 상품명 · 상품 가격(USD)을 담는다` → `… · 승인 뒤 돌아갈 주소를 담는다` | 본문 전체를 `toEqual`로 비교하는 테스트. 새 필드 `payment_source.paypal.experience_context`만큼 기대값을 늘렸다. 나머지 기대값은 한 글자도 바꾸지 않았다 |
| `reports/… › 승인 URL 12개가 모두 sandbox.paypal.com이다` → `표의 승인 URL 12개가 …` | 안내에 `example.com` 주소 한 줄이 생겨 파일 전체를 `https?://` 정규식으로 긁으면 13개가 된다. 테스트의 뜻(표의 승인 링크 12개가 모두 샌드박스)을 지키려고 **표 행(`| O01 | …`)의 링크 칸만** 긁도록 바꿨다. 안내의 그 주소는 승인 링크가 아니다 |
| `승인 링크 고르기 › approve가 없으면 payer-action을 쓴다` | 지시서 2번대로 네 경우 + 대소문자로 쪼갰다 (기존 단정은 모두 새 테스트 안에 그대로 남아 있다) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 119 (9 skipped) | 0 | 9 파일. 손대지 않았다 |
| `npm test` | 970 | 0 | 18 파일. `sandbox-orders.test.ts` 63건(+14), `sandbox-orders-protect.test.ts` 26건(+2) |
| `npx tsc --noEmit` | 출력 없음 | 0 | 자기 파일 오류 없음 |
| `npm run lint` | 출력 없음 | 0 | 경고 0 (처음 1건 `no-unused-vars` 경고를 고쳤다) |

가짜 클라이언트와 임시 폴더(`mkdtempSync`)만 쓴다 — 저장소의 manifest·링크 파일은 테스트도 건드리지 않는다
(`임시 폴더만 쓴다` 테스트가 경로를 확인한다).

## 남은 문제
- 이 고침은 **다음에 주문을 다시 만들 때** 효과가 확인된다. 지금 12건은 캡처가 끝나 새로 만들지 않았으므로
  (지시서 "하지 않을 것") `experience_context`가 실제 샌드박스 승인 화면에서 돌아오게 하는지는 **미검증**이다.
  `npm run sandbox:orders -- --fresh`를 돌릴 일이 생기면 그때 사람이 승인 화면 마지막 버튼을 눌러
  `https://example.com/afterloop/return?...`으로 넘어가는지 확인하면 된다 (브라우저가 "사이트에 연결할 수 없음"을
  보여 주는 것이 정상이다 — 주소창의 그 주소가 승인 완료 신호다).
- `return_url`을 받아 줄 서버는 없다 (의도대로). 데모에서 승인 화면을 보여 줄 계획이 있다면 나중에 Render 주소로
  바꾸는 것이 자연스럽지만, 지시서 범위를 넘으므로 하지 않았다.
- **`tests/sandbox/last-run.md`가 커밋되지 않은 상태로 바뀌어 있다 (내가 바꾼 것이 아니다).** 내용은
  `npm run sandbox:check`의 2026-11-10 08:25 KST 실행 기록(주문 12건 COMPLETED + 캡처 ID)이다. 내 명령은
  08:23~08:24에 끝났고(`npm test`·`vitest`·`tsc`·`lint`), 단위 테스트는 모두 가짜 클라이언트에 임시 폴더
  `root`를 넘기므로 저장소의 이 파일을 쓸 수 없다 — 실제 주문·캡처 ID가 적혀 있는 것이 그 증거다. **같은
  worktree에서 다른 세션이 `sandbox:check`를 돌린 것으로 보인다.** 내 수정 가능 파일이 아니므로 **커밋하지도
  않고 되돌리지도 않았다** (되돌리면 그 세션의 기록이 사라진다). 컨트롤 타워가 확인해 주기 바란다.

## 컨트롤 타워에 요청할 결정
- 없음. 계약(`SPEC.md`, `src/types.ts`, `tests/acceptance/`)과 manifest 모양은 바꾸지 않았고 바꿀 필요도 없었다.
