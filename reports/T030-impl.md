# T030 보고 (2026-11-10 00:20)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예** — `# SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal / `8852503`
- 실제 PayPal 호출: **0회.** `npm run sandbox:orders`·`sandbox:capture`·`sandbox:check`·`sandbox:disputes`·`sandbox:setup`을 어떤 옵션으로도 실행하지 않았다. 실행한 것은 `npx vitest`·`npm test`·`npm run test:acceptance`·`npx tsc`·`npm run lint`·git뿐이다. `.env`는 열지 않았고 내용을 출력하지도 않았다 (단위 테스트는 가짜 클라이언트와 `mkdtempSync` 임시 폴더만 쓴다 — 저장소의 manifest·링크 파일을 읽거나 쓰지 않는다).

## 결과
**완료.** 지시서 "고칠 것" 1~7번을 모두 구현했다. `tests/sandbox/manifest.json`과 `reports/sandbox-approve-links.md`는 한 글자도 바뀌지 않았다 (`git diff --stat`에서 두 파일 0줄).

| 지시서 | 어떻게 |
|---|---|
| 1. 캡처된 주문은 어떤 경로로도 다시 만들지 않는다 | `--fresh`: manifest에 `captureId`가 있으면 상태만 조회하고 **POST하지 않는다**. 404·403·400·200(`CREATED`)·조회 예외 모두 `kept (captured)` + 경고 한 줄(`문제:` 목록, 종료 1). 옵션 없는 경로는 2번 때문에 애초에 POST하지 않는다 |
| 2. 옵션 없는 실행 | manifest에 주문 ID가 있는 키는 호출 0회로 건너뛴다(`kept`). 12건이 다 있으면 `already created — use \`-- --status\` to check, \`-- --fresh\` to recreate expired ones` + **종료 0**, manifest·링크 파일을 쓰지 않는다. 없는 키만 만들고 `captureId`·`previousOrderIds`·`disputes`는 그대로 둔다 |
| 3. `--fresh`는 살아 있는 주문을 버리지 않는다 | 건마다 먼저 `GET`. `COMPLETED`→`kept (captured)`, `APPROVED`→`kept (approved)`, `CREATED`·`PAYER_ACTION_REQUIRED`·만료(404·`ORDER_EXPIRED`)→`recreated`, 그 밖(5xx·403·예외·`VOIDED` 같은 모르는 상태)→`skipped (status unknown)`으로 **건드리지 않고** 종료 코드 1 |
| 4. 전부 실패한 `--fresh`가 링크 파일을 덮지 않게 | 새로 만든 주문(`recreated`+`existing`)이 0건이면 manifest·링크 파일을 **쓰지 않는다**. 일부만 성공하면 성공한 행만 바꾸고 12행을 모두 남긴다: 승인·캡처된 행은 링크 대신 상태(`승인됨 — …` / `이미 캡처됨 — …`), 손대지 않은 행은 지금 링크 파일에서 읽은 **기존 링크 그대로**(`readApproveLinkCells`) |
| 5. `--`를 빼먹은 실행 막기 | `npm_config_fresh`·`npm_config_status`가 있는데 인자에 그 옵션이 없으면 **자격 증명을 읽기 전에** 멈춘다 (호출 0회, 종료 1). 문구: ``옵션은 `--` 뒤에: npm run sandbox:orders -- --fresh``. 공용 모듈 `scripts/sandbox/npm-args.ts` |
| 6. 캡처 결과 구분 | `purchase_units[].payments.captures[].status`로 가른다. `COMPLETED`→`captured · ok`+`captureId` 기록, `PENDING`→`captureId`는 기록하되 `captured · pending (사유)`, `DECLINED`·`FAILED`→`capture failed (상태)`이고 `captureId`를 **적지 않는다**+종료 1. 상태를 못 읽으면 "끝났다"고 적지 않는다(`captured · pending (캡처 상태 (없음))`). manifest에 `captureId`가 있는 주문은 **조회도 캡처도 하지 않는다** |
| 7. 링크 파일 안내 | `renderApproveLinks`에 "**이 파일은 마지막 실행이 쓴 것만 쓴다. 승인을 시작한 뒤에는 `--fresh`를 다시 실행하지 않는다.**" 두 줄을 넣었다 (**코드만** 고쳤다. 지금 있는 파일은 건드리지 않았으므로 다음에 스크립트가 쓸 때 들어간다) |

부수적으로 넣은 것 2개:
- `sandbox:check`의 `--json`·`--probe-request-id`에도 5번 보호를 넣었다 (옵션이 있는 다른 스크립트는 이것뿐이다. 캡처 스크립트는 옵션이 없고 `sandbox:disputes`도 옵션이 없어 삼켜질 것이 없다. `sandbox:setup`의 `track`·`disputes`는 플래그가 아닌 위치 인자라 npm이 삼키지 않는다).
- 시드 표에 없는 키의 manifest 항목(`O99` 같은 것)도 지우지 않고 그대로 남긴다 (`unknownKeyOrders`). 전에는 조용히 사라졌다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/create-sandbox-orders.ts` | 생성 경로가 manifest에 있는 키를 건너뛴다(`kept`, `KEPT_NOTE`, `ALREADY_CREATED_NOTE`). `--fresh`에 `keepDecision`(조회만으로 보존 판정) + `FreshResult`/`FRESH_LABEL`(`recreated`·`kept (approved)`·`kept (captured)`·`skipped (status unknown)`). 링크 파일: `linkCell`·`readApproveLinkCells`·`createLinkRows`·`freshLinkRows`·안내 2줄. 모드별 실행을 `runStatusMode`/`runCreateMode`/`runFreshMode`로 떼어내 `root`와 클라이언트를 주입받게 했다 (단위 테스트가 실제 자격 증명·네트워크 없이 파일 쓰기·종료 코드를 볼 수 있다). `main(args, now, procEnv, deps)`에 npm 옵션 보호를 맨 앞에 넣었다 |
| `scripts/capture-sandbox-orders.ts` | `CaptureResult`(`captured`·`captured_pending`·`skipped`·`not_approved`·`failed`) + `CAPTURE_LABEL`/`captureLabel`/`CaptureRow.label`, `firstCapture`(id·status·status_details.reason). `captureId`가 있는 주문은 호출 없이 건너뛴다. 종료 코드: 캡처 안 된 건·보류 건·`captureId` 없는 건이 있으면 1 |
| `scripts/sandbox/npm-args.ts` (새 파일) | `npmConfigKeys`·`swallowedOptions`·`swallowedOptionsMessage`·`swallowedOptionsError`. 옵션 이름만 다루고 비밀값은 보지 않는다 |
| `scripts/sandbox/check.ts` | `--json`·`--probe-request-id`에 같은 보호 (12줄) |
| `tests/unit/sandbox-orders.test.ts` | T030이 뒤집은 기대값 5개를 갱신(아래 "기대값을 바꾼 테스트") + 키별 건너뛰기·시드 밖 키 보존 테스트 2개 추가 (49 → 50개) |
| `tests/unit/sandbox-orders-protect.test.ts` (새 파일) | T030 보호 24개. 가짜 클라이언트 + 임시 폴더(`mkdtempSync`)만 쓴다 |

### 기대값을 바꾼 테스트 (이유)
지시서가 기존 동작을 뒤집으라고 한 자리들이다. 인수 테스트(`tests/acceptance/`)는 하나도 고치지 않았다.
1. `runCreateOrders` "다시 실행하면 같은 요청 ID로 200이 와서 중복 주문이 생기지 않는다" → "이미 있는 주문은 POST하지 않는다 (호출 0회)". 지시서 2번.
2. "manifest에 있던 주문 ID와 다른 ID가 오면 문제로 적고 새 ID를 쓴다" → "manifest에 주문 ID가 있는 키는 건드리지 않는다". 그 길(새 ID로 덮기)이 바로 T026 검증 문제 2번이라 막았다.
3. "같은 주문이면 manifest의 캡처 ID를 이어 쓴다" → 위 2번 테스트에 흡수 (POST 자체를 하지 않으므로 `captureId`가 그대로 남는 것으로 확인).
4. `runFreshOrders`의 결과 이름 `created`→`recreated`, `kept`→`kept-captured` (지시서 3번의 표 문구).
5. "이전 주문 ID는 … 캡처 ID는 이어 쓰지 않는다"의 입력에서 `captureId: 'CAP-OLD'`를 뺐다. 지시서 1번에 따라 `captureId`가 있는 주문은 아예 새로 만들지 않으므로 그 입력으로는 `previousOrderIds` 동작을 볼 수 없다. 캡처된 주문의 보존은 새 파일의 전용 테스트가 본다.
6. 캡처 테스트의 가짜 응답에 `captures[].status: 'COMPLETED'`를 넣었다 (지시서 6번에 따라 상태가 없으면 더 이상 "ok"가 아니다). `pending`(승인 전)이라는 이름은 캡처의 `PENDING`과 헷갈려 `not_approved`로 바꿨다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 654 | 0 | 파일 15개. `sandbox-orders.test.ts` 50 + `sandbox-orders-protect.test.ts` 24 포함 (T029 때 629 → +25) |
| `npm run test:acceptance` | 119 | 0 | 9개 건너뜀 (AC13 샌드박스 묶음, `RUN_SANDBOX` 없음). 기대값·파일을 고치지 않았고 그대로 통과한다 |
| `npx tsc --noEmit` | — | 0 | 출력 없음 |
| `npm run lint` | 통과 | — | 출력 없음 |
| `git diff --stat -- tests/sandbox/manifest.json reports/sandbox-approve-links.md` | — | — | **출력 없음 = 두 파일 0줄 변경** |

새 단위 테스트가 보는 것 (지시서 완료 기준과 1:1):
- `captureId` 있는 주문 + 조회 404 → 그대로, POST 0회, 경고 1줄 / 403·400·200(`CREATED`)·조회 예외에서도 같음 / 200 `COMPLETED`면 경고 없음
- 12건 다 있는 manifest + 옵션 없는 실행 → **호출 0회**, `already created …` 출력, 종료 0, manifest·링크 파일 바이트 동일
- 1건만 있는 manifest → 11건만 POST(`afterloop-order-O01`은 안 나간다), `captureId`·`previousOrderIds`·`disputes` 보존, 링크 파일 12행(O01은 지난 링크)
- `APPROVED` 3건 + `CREATED` 9건 → POST 9회, 3건 `kept (approved)`로 보존 / `PAYER_ACTION_REQUIRED`·404 → `recreated` / 5xx·예외·`VOIDED` → `skipped` + 종료 1
- `--fresh` 전부 실패(401) → manifest·링크 파일 **바이트 동일**, "새로 만든 주문이 0건" 출력, 종료 1
- `--fresh` 일부 성공 → 캡처·승인 행은 상태 칸, 손대지 않은 행은 기존 링크, 새 행은 새 링크, 12행 유지, `disputes` 보존
- `npm_config_fresh=true` + 인자 없음 → 호출 0회·종료 1 (주입한 `loadEnv`·`makeClient`가 던지게 해 둬서, 보호가 안 걸리면 테스트가 실패한다) / `-- --fresh`로 제대로 주면 걸리지 않음
- 캡처 `COMPLETED`·`PENDING(사유)`·`DECLINED`·`FAILED`·상태 없음 / `captureId` 있는 주문은 조회·캡처 0회

## 아침에 실행하는 사람을 위한 순서 (5줄)
1. `.env`가 있는 이 worktree(`afterloop-wt/paypal`)에서 **먼저 조회만** 한다: `npm run sandbox:orders -- --status`. 12건이 `CREATED`면 지금 `reports/sandbox-approve-links.md`의 링크를 그대로 쓴다 (2번을 건너뛴다). "expired or not found"가 보이면 2번.
2. `npm run sandbox:orders -- --fresh` — **가운데 `--`를 반드시 넣는다** (빼면 이제 "옵션은 `--` 뒤에 …"만 찍히고 아무것도 하지 않는다). 첫 줄의 `요청 ID 접미사: r…`과 표의 `recreated` 건수를 확인한다. `skipped (status unknown)`이 있으면 그 주문은 손대지 않았다는 뜻이다 (종료 코드 1이 정상).
3. **마지막 실행이 쓴 링크 파일만** 브라우저 에이전트에게 준다. 링크 자리에 `승인됨` / `이미 캡처됨`이 적힌 행은 승인할 것이 없다. 승인을 한 건이라도 시작한 뒤에는 `--fresh`를 다시 돌리지 않는다 (아직 승인 전인 주문이 새 주문으로 바뀐다).
4. 승인이 끝나면 `npm run sandbox:capture`. 표의 `captured · ok`가 몇 건인지 본다. `captured · pending (…)`은 캡처 ID는 적혔지만 정산 전이고(종료 1), `capture failed (DECLINED)`는 돈이 움직이지 않았다 — 두 경우 `npm run sandbox:check`로 한 번 더 본다. 다시 돌려도 이미 캡처된 주문은 건드리지 않는다.
5. 옵션 없는 `npm run sandbox:orders`는 이제 **이미 있는 주문을 다시 만들지 않는다** (12건이 다 있으면 `already created …`만 찍고 종료 0). 만료된 링크를 새로 만들려면 반드시 `-- --fresh`를 쓴다. 끝으로 바뀐 `tests/sandbox/manifest.json`·`reports/sandbox-approve-links.md`를 이 worktree에서 커밋한다.

## 남은 문제
- **내 쪽에서 확인하지 못한 것**: 실호출을 하지 않았으므로 PayPal이 실제로 어떤 응답을 주는지는 가정이다. 특히 ⓐ 캡처 응답의 `captures[0].status`가 `COMPLETED`/`PENDING`으로 오는지 ⓑ 만료된 주문이 404 `RESOURCE_NOT_FOUND`로 오는지 ⓒ 같은 접미사 재실행의 200 응답에 승인 링크가 들어 있는지 (T029 검증 문제 5번과 같은 한계). 모두 가짜 응답으로만 돌렸다.
- `--fresh`의 접미사는 여전히 **분 단위**다. 1분이 지나 다시 돌리면 새 주문이 또 생긴다. 다만 이제 `APPROVED`·`COMPLETED`·`captureId` 있는 주문은 보존되므로 T029 검증 문제 2번의 피해 범위가 "아직 승인 전인 주문"으로 줄었다. 승인 시작 뒤 재실행 금지는 여전히 운영 규칙이다 (링크 파일 안내에 넣었다).
- `--fresh`에서 "조회는 200 `COMPLETED`인데 manifest에 `captureId`가 없는" 주문은 `kept (captured)`로 보존하지만 **`captureId`를 manifest에 적지는 않는다** ("그대로 둔다"를 지켰다). 그 값은 `npm run sandbox:capture`(또는 `-- --status`)가 적는다.
- 링크 파일의 "바뀌지 않은 행"은 지금 링크 파일의 그 행을 글자 그대로 옮긴다. 그 행이 예전 실행에서 이미 "승인 링크 없음 — …"이었다면 그 문구가 그대로 남는다 (링크를 스크립트가 추측해 만들지는 않았다).
- 캡처가 `PENDING`이면 종료 코드 1로 끝낸다. 지시서는 `DECLINED`·`FAILED`만 1을 요구했지만, 보류는 사람이 반드시 봐야 하는 상태이고 "0 = 끝났다"로 읽히면 안 된다고 판단했다 (`captured · pending`은 실패가 아니라는 안내를 stderr에 함께 찍는다). 컨트롤 타워가 0을 원하면 `capture-sandbox-orders.ts`의 `main()` 마지막 줄 한 곳만 바꾸면 된다.
- `main()`을 실제 진입점으로 돌려 본 적은 없다 (스크립트 실행 금지). `main()`의 분기는 주입한 `loadEnv`·`makeClient`·`root`로 테스트했고, 모드 본체(`runCreateMode`·`runFreshMode`)는 임시 폴더로 끝까지 돌렸다.

## 컨트롤 타워에 요청할 결정
- **없음** (계약·인수 테스트·SPEC을 바꿀 필요는 없었다). `src/types.ts`·`tests/acceptance/`·`config/`·`seed/`·`package.json`·manifest·링크 파일은 건드리지 않았다. manifest 스키마도 그대로다 (`captureId`·`previousOrderIds`는 T029에 이미 있는 선택 필드다).
- 참고로 남겨 두는 판단 2개 (지시서 범위 안이라 스스로 결정했다): ⓐ 위 "남은 문제"의 `PENDING` 종료 코드 1 ⓑ `sandbox:check`에도 `--` 보호를 넣은 것 (지시서 5번의 "필요하면 넣는다").
