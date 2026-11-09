# T030 검증 (2026-11-10 00:27 KST)
- 판정: **통과**
- 검증 대상: 커밋 da4902e (lane/paypal의 T030) · 기준 SPEC v2.2 · 실호출 없이 검증
- 한 줄 요약: 캡처·승인된 주문을 덮어쓰는 경로, 전부 실패한 실행이 파일을 덮는 경로를 찾지 못했다 (실제 manifest 사본 + 가짜 PayPal로 369개 확인, 실패 0). 병합 차단 문제는 없다. 다만 **캡처가 `DECLINED`·`PENDING`으로 끝난 뒤 `sandbox:capture`를 다시 실행하면 종료 코드가 0으로 바뀌고, `DECLINED`였던 캡처의 ID가 manifest에 적히는 경로**가 있다 (아래 문제 1·2. 아침에는 "첫 캡처 실행의 표"가 유일한 근거다).
- 검증 방법: `.env`가 없는 사본(`afterloop-wt/verify-tmp`, 분리된 HEAD)에서만 실행했다. `npm run sandbox:*`는 실행하지 않았고, `afterloop-wt/paypal` 폴더에는 들어가지 않았으며, 어떤 `.env`도 열지 않았다. 스크립트 로직은 실제 `createPayPalClient` + 가짜 `fetch`로 돌렸고, 프로세스 전체를 OS 수준에서 외부 IP 연결 차단(`sandbox-exec … deny network-outbound (remote ip)`, 일반 `fetch`가 `EPERM`인 것 확인) 상태로 실행했다. 승인 링크 URL에는 접속하지 않았다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 654 | 0 | 파일 15개. `sandbox-orders.test.ts` 50, `sandbox-orders-protect.test.ts` 24 포함 |
| `npm run test:acceptance` | 119 | 0 | 9개 건너뜀 (AC13 샌드박스 묶음, `RUN_SANDBOX` 없음) |
| `npx tsc --noEmit` | 종료 0 | — | 오류 0 |
| `npm run lint` | 종료 0 | — | 출력 없음 |
| `git diff --name-only 55f8580..HEAD` | — | — | 7개 파일. 모두 지시서 "수정 가능 폴더" + `reports/T030-impl.md` |
| `git diff --stat 55f8580..HEAD -- package.json src seed config tests/acceptance tests/sandbox reports/sandbox-approve-links.md SPEC.md` | — | — | 출력 없음 = 변경 0 |
| 주문 스크립트 `main()` 하네스 (실제 manifest·링크 파일 사본을 임시 폴더에 복사, 실제 클라이언트 + 가짜 fetch) | 304 | 0 | `main(args, now, procEnv, { loadEnv, makeClient, root })`에 주입. 원본 코드를 그대로 import |
| 캡처 스크립트 `main()` 하네스 (스크래치 사본) | 65 | 0 | 캡처 `main()`은 주입을 받지 않아 `scripts/`·`src/`·`seed/`를 스크래치에 복사(`diff -r` 동일)하고 전역 `fetch`를 가짜로 바꿔 그 사본의 `main()`을 불렀다. 자격 증명은 프로세스 안의 가짜 값. 파일 쓰기는 사본 안에서만 |
| 실제 npm 10.8.2로 `--` 빠진 실행 재현 (스크래치의 더미 패키지, 스크립트 이름 `orders`) | 5 | 0 | `npm run orders --fresh` → `argv=[]`, `npm_config_fresh=true` → 주문 `main()`이 호출 0회·`loadEnv` 0회·종료 1 |
| `check.ts` 진입점 보호 (스크래치 사본, 가짜 fetch) | 8 | 0 | 아래 (i) |
| 진입점 확인 (스크래치 사본, 자격 증명 없음) | 4 | 0 | `create-…`·`capture-…` 둘 다 "`.env`에 … 없다" + 종료 1, 파일 쓰기 없음 |
| `git status -s` (끝) | — | — | `?? reports/T030-verify.md` 한 줄 |

기존 테스트의 바뀐 기대값(`git diff 55f8580..HEAD -- tests/unit/sandbox-orders.test.ts`)은 모두 지시서가 뒤집으라고 한 동작과 맞는다: ① 재실행 시 12건 다시 POST → POST 0회 (고칠 것 2) ② "다른 ID가 오면 새 ID로 덮는다" 테스트 → "있는 키는 건드리지 않는다" (고칠 것 1·2) ③ 결과 이름 `created`→`recreated`, `kept`→`kept-captured` (고칠 것 3) ④ 캡처 가짜 응답에 `captures[].status` 추가, 승인 전 이름 `pending`→`not_approved` (고칠 것 6) ⑤ 링크 파일의 캡처된 행 "승인 링크 없음 — …" → 상태 표시 (고칠 것 4). 인수 테스트는 바뀌지 않았다.

## 아침 시나리오 재현 (실제 manifest 사본 + 가짜 클라이언트)
입력은 지금 저장소의 `tests/sandbox/manifest.json`(12건, `captureId` 없음)과 `reports/sandbox-approve-links.md`를 임시 폴더에 복사한 것이다. "보낸 요청"은 가짜 fetch가 받은 것 전부다 (토큰 발급 `POST /v1/oauth2/token` 1회는 따로 적지 않았다. "호출 0회"는 토큰 발급도 없다는 뜻). 5xx·네트워크 예외는 클라이언트가 건당 3번 보낸다.

| 단계 | 입력 상태 | 보낸 요청 | 파일 변화 | 종료 코드 | 기대와 일치 |
|---|---|---|---|---|---|
| (a) 옵션 없음 | 12건 다 있음 | 호출 0회 | manifest·링크 파일 불변 | 0 | 예. `already created — use \`-- --status\` to check, \`-- --fresh\` to recreate expired ones` 출력 |
| (b) `--status` | 12건 `CREATED` | GET 12 | 불변 | 0 | 예. "조회만 했다" 출력 |
| (b) `--status` | 12건 404 | GET 12 | 불변 | 1 | 예. 12행 `expired or not found` |
| (c) `--fresh` | 12건 404(만료) | GET 12 + POST 12, 요청 ID `afterloop-order-O01-r202611100730` 꼴 12개 | manifest: `orderId` 12개 바뀜, `previousOrderIds` = [옛 ID], `key`·`buyer`·`sku`·`tracked`·`disputes` 보존. 링크 파일: 12행 4열, 12행 모두 새 주문의 샌드박스 링크 | 0 | 예 |
| (d) `--fresh` | 12건 `CREATED`(살아 있음) | GET 12 + POST 12 | 12건 모두 새 ID | 0 | 예. 지시서 3번이 "`CREATED`·`PAYER_ACTION_REQUIRED`·만료·404만 새로 만든다"고 했으므로 살아 있는 `CREATED`를 버리는 것이 지시대로다 (그래서 아침에는 `--status`가 12건 `CREATED`면 `--fresh`를 쓰지 않는다) |
| (d2) `--fresh` 같은 분 재실행 | 위 직후 | GET 12 + POST 12 (같은 요청 ID) | 주문 ID 그대로, 파일 내용 동일 | 0 | 예 (가짜가 200으로 같은 주문을 돌려줌) |
| (d3) `--fresh` 2분 뒤 재실행 | 위 직후, 승인 0건 | GET 12 + POST 12 | 12건 또 새 ID (`previousOrderIds` 2개), 링크 12행 = manifest | 0 | 예 (지시대로. 승인 전이라 잃는 것 없음) |
| (e) `--fresh` 승인 도중 | `APPROVED` 3 + `CREATED` 9 | GET 12 + POST 9 | 승인된 3건 항목 한 글자도 안 바뀜, 9건 새 ID. 링크 파일 12행: 3행 "승인됨 — 승인 링크가 필요 없다 …", 9행 새 링크 | 0 | 예. 표에 `kept (approved)` 3 · `recreated` 9 |
| (f0) 옵션 없음 | `captureId` 12개 | 호출 0회 | 불변 | 0 | 예 |
| (f) `--fresh` | `captureId` 12개, 조회가 404 / 403 / 400 / 422 `ORDER_EXPIRED` / 200 `CREATED` / 200 `APPROVED` | GET 12, **POST 0** | manifest 바이트 동일, 링크 파일 불변 | 1 | 예. 12행 `kept (captured)` + 건별 경고 한 줄 |
| (f) `--fresh` | `captureId` 12개, 조회가 네트워크 예외 / 500 | GET 36, **POST 0** | 바이트 동일 | 1 | 예 |
| (f) `--fresh` | `captureId` 12개, 조회 200 `COMPLETED` | GET 12, POST 0 | 바이트 동일 | 0 | 예 (경고 없음) |
| (f) `--fresh` | `captureId` 12개, 토큰 401 | 토큰 POST 12, 그 밖 0 | 바이트 동일 | 1 | 예 |
| (f-mix) `--fresh` | `captureId` 4건(조회 404) + `CREATED` 8건 | GET 12 + POST 8 | 캡처된 4건 불변, 8건 새 ID. 링크 4행 "이미 캡처됨 …" | 1 | 예 |
| (g) `--fresh` 생성 전부 실패 | 12건 404, 생성이 500 / 422 / 네트워크 예외 | GET 12 + POST 36 / 12 / 36 (재시도의 요청 ID 동일) | **manifest·링크 파일 불변** | 1 | 예. "새로 만든 주문이 0건이다 — … 그대로 두었다" |
| (g) `--fresh` 토큰 401 | 12건 | 토큰 POST 12 | 불변 | 1 | 예 |
| (g) `--fresh` 일부 성공 | 12건 404, O03 422 · O07 예외 · O09 500 | GET 12 + POST 16 | 성공 9건만 새 ID, 실패 3건 항목 불변. 링크 파일 12행: 9행 새 링크, 3행 기존 링크 그대로 | 1 | 예 |
| (h) `--fresh` 조회 실패 | O02 조회 예외 · O05 500 · O06 403 · O08 `VOIDED`, 나머지 `CREATED` | GET 16 + POST 8 | 4건 항목 불변·링크 그대로, 8건 새 ID | 1 | 예. 4행 `skipped (status unknown)` |
| (h2) `--fresh` | 12건 모두 조회 예외 | GET 36, POST 0 | 불변 | 1 | 예 |
| (i) 옵션 없음 + `npm_config_fresh=true` / `npm_config_status=true` / 둘 다 | 12건 `CREATED` | 호출 0회, `loadEnv` 0회 (자격 증명을 읽기 전) | 불변 | 1 | 예. "옵션은 \`--\` 뒤에: npm run sandbox:orders -- --fresh" |
| (i) 실제 npm: `npm run orders --fresh` · `--status` (더미 패키지) | 〃 | 호출 0회, `loadEnv` 0회 | 불변 | 1 | 예. npm 10.8.2가 `npm_config_fresh=true`·`npm_config_status=true`·`npm_config_json=true`·`npm_config_probe_request_id=true`를 넣는 것을 직접 확인 |
| (i) `-- --fresh` + `npm_config_fresh=true`, `npm_config_fresh=""`, 무관한 `npm_config_json=true` | 〃 | 평소대로 진행 | — | — | 예 (보호에 걸리지 않음) |
| (i) `sandbox:check` (사본): `npm_config_json=true` 또는 `npm_config_probe_request_id=true`·`npm_config_probe-request-id=true`, 인자 없음, 가짜 자격 증명 있음 | — | fetch 0회 | `last-run.md` 안 생김 | 1 | 예. `--json`을 인자로 주면 걸리지 않는다 (AC13은 `npx tsx scripts/sandbox/check.ts --json`으로 부른다) |
| (i) `sandbox:capture` + `npm_config_fresh=true` | 12건 `CREATED` | GET 12 (평소대로) | — | 1 | 보호 없음. 캡처 스크립트는 옵션을 받지 않으므로 삼켜질 것이 없다 |
| (j1) 캡처 | 12건 `APPROVED`, 캡처 응답 `COMPLETED` | GET 12 + 캡처 POST 12, 경로 `/v2/checkout/orders/{manifest orderId}/capture`, 요청 ID `afterloop-capture-O01`…`O12` | `captureId` 12개 기록, `orderId`·`previousOrderIds`·`disputes` 보존 | 0 | 예. 12행 `captured · ok` |
| (j2) 캡처 응답 상태별 | `PENDING`(사유 있음/없음) · `DECLINED` · `FAILED` · 상태 없음 · 소문자 `completed` · `REFUNDED` | GET 12 + POST 12 | `PENDING`: `captureId` 기록. `DECLINED`·`FAILED`: 기록 안 함. 상태 없음·`REFUNDED`: 기록 | 1 | 예. `captured · pending (PENDING_REVIEW)` / `captured · pending (사유 없음)` / `capture failed (DECLINED)` / `capture failed (FAILED)` / `captured · pending (캡처 상태 (없음))`. `PENDING` 1건뿐이어도 종료 1 (j6) |
| (j3) 일부만 승인 | 8 `APPROVED` + 4 `CREATED` | GET 12 + POST 8 | `captureId` 8개 | 1 | 예. 건별 "not approved yet · 주문 상태 CREATED" 4줄 |
| (j3) 다시 실행 | 나머지 4건 승인 뒤 | GET 4 + POST 4 (앞 8건은 조회도 없음) | `captureId` 12개 | 0 | 예 |
| (j4) 다시 실행 | 12건 캡처 뒤 | 호출 0회 | 내용 그대로 (파일은 다시 쓰며 키 순서가 한 번 바뀔 수 있다 — 문제 6) | 0 | 예 |
| (j7) 캡처 500×3 뒤 다시 실행 | O01 | 첫 실행 POST 3회 + 재실행 1회, 요청 ID 4개 모두 `afterloop-capture-O01` | 재실행에서 `captureId` 기록 | 1 → 0 | 예 (재실행에도 같은 요청 ID) |
| (j) 토큰 401 / 12건 404 | 12건 | 토큰 POST 12 / GET 12, 캡처 POST 0 | 내용 그대로 | 1 | 예 |
| (k) 새 링크가 live·유사 도메인 | `--fresh`, 옵션 없음(빈 manifest) | 첫 POST 1회에서 멈춤 | 불변 | 1 | 예. 문구에 도메인만 (링크 전체 없음) |
| (k) `PAYPAL_BASE_URL`이 샌드박스가 아님 | 주문 스크립트 3개 모드 × (`api-m.paypal.com` · 유사 도메인 · `http://`), 캡처 × (`api-m.paypal.com` · 유사 도메인), check × `api-m.paypal.com` | 호출 0회 | 불변 | 1 | 예. 받은 주소를 출력하지 않는다 |
| (z) 아침 순서 전체 | 12건 만료 → `--status` → `--fresh` → 8건 승인 → 캡처 → **실수: 옵션 없음** → **실수: `--fresh`(10분 뒤)** → 나머지 승인 → 캡처 → `--status` → **실수: `--fresh`** → **실수: 옵션 없음** | 실수 실행들: 옵션 없음은 호출 0회, `--fresh`는 GET 12 + POST(미승인 건만) | 캡처된 8건의 `orderId`·`captureId`는 끝까지 그대로. 두 번째 `--fresh`는 미승인 4건만 새 ID로 바꿈. 끝의 실수 실행 2번은 manifest 바이트 동일 | 0 | 예 |

## 지시서 대조
| 항목 | 판정 | 근거 |
|---|---|---|
| 1. 캡처된 주문은 어떤 경로로도 다시 만들지 않는다 (404·403·400·실패 포함, 경고 한 줄) | 충족 | (f) 10가지 응답 모두 POST 0·manifest 바이트 동일. `keepDecision`이 `captureId`가 있으면 어떤 응답에도 `kept-captured`를 돌려준다. 옵션 없는 경로는 있는 키를 POST하지 않는다 (f0, z) |
| 2. 옵션 없는 실행: 있는 키 POST 안 함, 12건 다 있으면 안내 + 종료 0, 없는 키만, `captureId`·`previousOrderIds`·`disputes` 보존 | 충족 | (a), (f0). manifest에 10건만 있을 때 O11·O12만 POST(요청 ID 접미사 없음), 기존 10건·`disputes` 그대로, 링크 12행 (x2) |
| 3. `--fresh`: `APPROVED`·`COMPLETED` 보존, `CREATED`·`PAYER_ACTION_REQUIRED`·만료·404만 새로, 건별 표기, 조회 실패는 `skipped (status unknown)` + 종료 1 | 충족 | (c)(d)(e)(h), `PAYER_ACTION_REQUIRED`·422 `ORDER_EXPIRED`·`COMPLETED`(manifest에 `captureId` 없음)·`APPROVED` 섞인 경우도 확인 (y1) |
| 4. 새로 만든 주문 0건이면 두 파일 그대로, 일부 성공이면 성공한 건만, 링크 12행 유지 | 충족 | (g) 3가지 전부 실패 + 토큰 401, (g-partial), (h), (f-mix) |
| 5. `--` 빠진 실행 막기 (`npm_config_fresh`·`npm_config_status`, 호출 0회, 안내, 종료 1) | 충족 | (i). 실제 npm 10.8.2로도 확인. `sandbox:check`에도 들어 있다. 캡처·분쟁 스크립트는 옵션이 없다 |
| 6. 캡처 결과 구분 (`COMPLETED`만 ok, `PENDING`은 기록 + pending 표기, `DECLINED`·`FAILED`는 failed + 종료 1, `captureId` 있으면 다시 캡처 안 함) | 충족 (캡처 응답 기준) | (j1)(j2)(j3)(j4). 단 **다시 실행했을 때** 결과가 달라지는 경로가 있다 — 문제 1·2 |
| 7. 링크 파일 안내 문구 (코드만) | 충족 | (c)에서 새로 쓴 파일 머리에 "**이 파일은 마지막 실행이 쓴 것만 쓴다. 승인을 시작한 뒤에는 `--fresh`를 다시 실행하지 않는다.**" + 설명 한 줄. 지금 저장소의 링크 파일은 그대로다 |
| 링크 파일 형식 | 충족 | 12행 4열(`주문번호·구매자·금액·approve URL`), 승인된 행 "승인됨 — …", 캡처된 행 "이미 캡처됨 — …", 임시 폴더에 만들어진 manifest·링크 파일 111개에 `@` 0건 |
| 비밀값 비노출 | 충족 | 가짜 Secret·Basic·토큰을 오류 본문(`message`·`description`)과 예외 문구에, 가짜 이메일·`payer_id`·이름을 응답에 심었고, 가짜 Client ID는 자격 증명으로만 넣었다. 정상·401·4xx·5xx·예외 모든 시나리오의 stdout·stderr·manifest·링크 파일에서 0건 (예외 문구 안의 비밀값은 `[redacted]`). 새 출력에 실리는 것은 주문 키·주문 ID·주문 상태·HTTP 상태·캡처 ID·캡처 상태·`status_details.reason`·오류 `name`·`issue`·`debug_id`뿐이다. 예외 문구에 관한 예외 하나는 문제 7 |
| 완료 기준: 단위 테스트 사례 | 충족 | `sandbox-orders-protect.test.ts` 24개가 지시서의 6가지 사례를 모두 다룬다 |
| 완료 기준: manifest·링크 파일 0줄 변경, 실호출 0회 | 충족 (파일) / 확인 불가 (실호출) | 두 파일 diff 0. 실호출 0회는 구현자 주장이고, 파일과 모순은 없다 |
| 범위 | 충족 | 바뀐 파일 7개 모두 허용 범위. `package.json`·`src/`·`seed/`·`config/`·계약 파일 변경 0 |

## 발견한 문제
**병합 차단: 없음.**

### 아침 캡처 전에 알아야 할 것
1. **[병합 후 수정] 캡처가 `DECLINED`·`FAILED`였던 주문이 PayPal에서 주문 상태 `COMPLETED`로 남으면, `sandbox:capture`를 다시 실행할 때 그 캡처 ID가 manifest에 적히고 종료 코드가 0이 된다.** 첫 실행: `capture failed (DECLINED)`, `captureId` 기록 안 함, 종료 1 (지시대로). 다시 실행: 주문 조회가 `COMPLETED` → T026 때부터 있던 "이미 캡처됨" 분기(`capture-sandbox-orders.ts` 139~145행)가 캡처 상태를 보지 않고 `firstCaptureId`를 적는다 → `skipped (already captured)`, 종료 0 (j2-재실행에서 확인: 캡처 POST 0회, `captureId` 12/12). 잃는 것은 없지만 **돈이 움직이지 않은 캡처의 ID가 manifest에 캡처 완료처럼 남는다.** 주문이 `APPROVED`로 남는 경우에는 다시 캡처를 시도한다 (j5). 201 + `DECLINED`가 샌드박스의 PayPal 지갑 결제에서 실제로 오는지는 실호출 없이 확인하지 못했다 (지갑 결제 거절은 보통 422로 온다).
2. **[병합 후 수정] `PENDING`은 첫 실행에서만 보인다.** 첫 실행은 `captured · pending (사유)` + 종료 1이고 `captureId`를 적는다 (지시대로). 다시 실행하면 그 주문은 조회 없이 `skipped (already captured)`이고 종료 0이다 (j6-재실행). 그리고 안내 문구가 가리키는 `npm run sandbox:check`와 `-- --status`는 **주문** 상태와 캡처 ID만 보여 주고 **캡처** 상태(`PENDING`인지 `COMPLETED`인지)는 보여 주지 않는다 (`check-steps.ts` `readOrder`, `runOrderStatus`). 가짜 응답에서 `PENDING` 캡처의 주문 상태는 이미 `COMPLETED`였다. 즉 보류가 풀렸는지를 이 저장소의 명령으로는 확인할 수 없다.
3. **[의견] 새로 만든 주문의 응답에 승인 링크가 없으면, 링크 파일에 옛 주문의 링크가 남는다.** `--fresh`에서 201인데 `links`에 `approve`가 없는 행: manifest는 새 ID로 바뀌고, 링크 칸은 "기존 링크 그대로" 규칙에 따라 **옛 주문 ID가 든 링크**가 그대로 남는다 (x1). 종료 1과 "승인 링크가 응답에 없다" 문제 줄은 나온다. 그 링크로 승인하면 옛 주문만 승인되고 `sandbox:capture`는 "not approved yet"이 된다. 지금까지 받은 201 응답 12건에는 모두 링크가 있었다. 같은 분 재실행(200)에서는 남는 링크가 같은 주문 것이라 문제가 없다.
4. **[의견] `--fresh`가 다루지 못하는 상태는 빠져나올 옵션이 없다.** `VOIDED`, 조회 403 같은 주문은 매번 `skipped (status unknown)` + 종료 1이다 (h). 강제로 다시 만드는 옵션은 없고, manifest에서 그 항목을 손으로 지운 뒤 옵션 없이 실행해야 한다 (그러면 접미사 없는 원래 요청 ID가 쓰인다). `captureId`가 적힌 주문도 같다 (의도된 동작).
5. **[의견] 표의 "상태" 칸.** 캡처 스크립트가 호출 없이 건너뛴 행은 HTTP 상태 칸에 "호출 실패"라고 찍힌다 (호출을 하지 않은 것이다). 비고 칸에는 "조회·캡처를 하지 않았다"가 맞게 적힌다.
6. **[의견] 호출 0회인 캡처 재실행도 manifest 파일을 다시 쓴다.** 내용은 같지만 `previousOrderIds`와 `captureId`가 둘 다 있는 항목의 키 순서가 한 번 바뀐다 (j4). `--fresh` 뒤에 캡처하면 12건이 모두 해당한다. git diff에 줄 이동으로만 보인다.
7. **[의견 · T030 이전부터] 예외 문구는 비밀값만 가려진 채 출력에 실린다.** 클라이언트는 Secret·Basic·토큰만 가린다. 가짜 fetch 예외 문구에 가짜 이메일을 심으면 stdout의 문제 줄에 그대로 나오고, 그 행에 지난 링크 기록이 없으면 링크 파일의 "승인 링크 없음 — …" 칸에도 들어간다 (x3). 실제 `fetch` 예외 문구에 구매자 정보가 들어가는 경우는 확인된 바 없다.

### 남은 위험 (아침 순서: `--status` → `--fresh` → 승인 → `sandbox:capture` → `--status`)
| 입력 | 일어나는 일 | 잃는 것 |
|---|---|---|
| 승인이 진행 중(주문이 아직 `CREATED`·`PAYER_ACTION_REQUIRED`)일 때 `--fresh` | 그 주문은 새 주문으로 바뀐다 (지시서 3번대로). 사람이 옛 링크로 승인을 마쳐도 manifest는 새 주문을 가리킨다 (z6: `not approved yet`) | 그 승인 1건 (새 링크로 다시 승인해야 한다). 옛 주문 ID는 `previousOrderIds`에 남는다. 조회와 생성 사이의 짧은 틈에 승인이 끝난 경우도 같다 |
| `--fresh` 일부 실패 뒤 다음 분에 다시 실행 | 성공했던 건도 `CREATED`이므로 전부 또 새로 만든다 (g-partial 재실행: 12/12 바뀜) | 없음 (승인 전이라면). 먼저 나눠 준 링크는 전부 무효 — 마지막 링크 파일만 쓴다 |
| 캡처 `DECLINED`·`PENDING` 뒤 `sandbox:capture` 재실행 | 문제 1·2 | 캡처가 안 끝났다는 표시 (첫 실행의 출력에만 있다) |
| 승인된 주문을 오래 두었다가 캡처 (PayPal 문서상 승인·캡처 기한 있음) | 캡처가 422·404로 실패 → `capture failed`, 종료 1. `--fresh`는 404면 새로 만든다 | 그 승인. 확인 불가 (실호출 금지) |
| 같은 주문 키로 캡처를 시도한 적이 있는데 주문이 새로 만들어져 다시 캡처 | 캡처 요청 ID가 주문 키 기준(`afterloop-capture-O01`)이라 같은 요청 ID가 다른 주문 URL로 나간다 (T026 검증의 지적 그대로) | PayPal이 어떻게 답하는지 확인 불가. 캡처를 시도한 적 없는 아침 흐름에는 해당 없음 |
| `.env`·manifest가 없는 다른 폴더에서 실행 | 자격 증명이 없으면 호출 0회로 끝난다. 자격 증명은 있는데 manifest가 비어 있는 폴더라면 옵션 없는 실행이 12건을 새로 만든다 (보호는 "manifest에 있는 키"에만 걸린다) | 없음. 다만 manifest가 두 폴더에서 갈라진다 — 항상 같은 worktree에서 실행한다 |

캡처·승인된 주문의 `orderId`·`captureId`를 잃는 경로는 찾지 못했다.

### `reports/T030-impl.md`와 다른 곳
- "남은 문제" 3번째 줄 "그 값(`captureId`)은 `npm run sandbox:capture`(또는 `-- --status`)가 적는다": `-- --status`는 캡처 ID를 **표에 보여 줄 뿐** manifest에 적지 않는다 ((b)에서 파일 불변, 출력도 "manifest·링크 파일은 쓰지 않았다"). 적는 것은 `sandbox:capture`뿐이다.
- "아침 순서" 4번 "두 경우 `npm run sandbox:check`로 한 번 더 본다": `sandbox:check`는 캡처 상태를 보여 주지 않는다 (문제 2). 그리고 "다시 돌려도 이미 캡처된 주문은 건드리지 않는다"는 맞지만, 다시 돌리면 `DECLINED`·`PENDING` 표시가 사라진다는 점이 빠져 있다 (문제 1·2).
- "기대값 5개를 갱신"이라고 적고 아래에 6개를 나열했다. 내용은 diff와 같다.
- 머리의 "마지막 커밋 `8852503`"은 코드 커밋이고, 보고서 커밋은 `da4902e`다. 보고 시각 00:20은 보고서 커밋 시각(00:11:25 +0900)보다 뒤다. 내용에는 영향 없다.
- 그 밖의 숫자는 직접 실행한 결과와 같다: `npm test` 654, `test:acceptance` 119 통과·9 건너뜀, `tsc` 오류 0, lint 통과, 테스트 50 + 24, 바뀐 파일 목록, `check.ts` 12줄.
- 확인할 수 없었던 주장: "실제 PayPal 호출 0회". 파일(manifest·링크 파일 diff 0)과 모순은 없다.

### 구현자가 판단해서 넣은 것 2개
- **캡처 `PENDING`도 종료 코드 1**: 지시서 6번 문장은 `DECLINED`·`FAILED`에만 종료 1을 명시했다. 충돌은 없다 — 이 종료 코드를 읽는 테스트·스크립트가 없고(AC13은 `check.ts`만 실행), 전에는 `captureId`가 12개면 0이었으므로 "보류인데 0"이 "보류면 1"로 바뀐 것뿐이다. 다만 다시 실행하면 0이 된다 (문제 2).
- **`sandbox:check`에도 `--` 보호**: 지시서 5번의 "필요하면 넣는다" 범위 안이다. AC13은 `npx tsx scripts/sandbox/check.ts --json`으로 부르므로 인자에 `--json`이 있어 걸리지 않는다 (사본에서 확인). 옵션을 주지 않은 평소 실행은 npm이 `npm_config_json`을 넣지 않으므로 걸리지 않는다 (npm 10.8.2에서 확인). 걸리는 것은 `npm run sandbox:check --json`처럼 `--`를 뺀 경우와, 사용자 npm 설정에 `json=true`가 있는 경우뿐이다.

## 아침에 실행하는 사람을 위한 순서 (이 코드 기준)
1. `.env`가 있는 worktree에서 `npm run sandbox:orders -- --status` (조회만). 12건 `CREATED`면 지금 링크 파일로 3번. "expired or not found"가 보이면 2번.
2. `npm run sandbox:orders -- --fresh` (가운데 `--` 필수. 빼면 "옵션은 `--` 뒤에"만 찍히고 종료 1). 첫 줄 "요청 ID 접미사: r…", 끝 줄 "recreated 12", 종료 0을 본다. 종료 1이고 **승인을 아직 시작하지 않았으면** 같은 명령을 다시 실행한다 (미승인 건의 링크가 전부 또 바뀐다).
3. **마지막 실행이 쓴** `reports/sandbox-approve-links.md`만 브라우저 에이전트에게 준다. 승인을 시작한 뒤에는 `--fresh`를 다시 돌리지 않는다 (승인·캡처된 주문은 안전하지만 승인 중인 주문의 링크가 바뀐다).
4. `npm run sandbox:capture`. **첫 실행의 표를 그대로 보관한다.** "not approved yet"만 남았으면 승인 뒤 같은 명령을 다시 실행한다 (나머지만 캡처한다).
5. 표에 `capture failed (DECLINED/FAILED)`나 `captured · pending`이 한 건이라도 있으면 **다시 실행하지 말고** 사람이 샌드박스 화면에서 그 캡처를 확인한다 (다시 실행하면 종료 0으로 바뀌어 구분할 수 없다).
6. `npm run sandbox:orders -- --status`로 12건 `COMPLETED` + 캡처 ID 12개를 확인하고, 그 worktree에서 manifest·링크 파일을 커밋한다.
7. 옵션 없는 `npm run sandbox:orders`는 실수로 돌려도 호출 0회·파일 불변이다. 만료된 링크는 `-- --fresh`로만 다시 만든다.

## 컨트롤 타워가 결정할 것
1. **문제 1·2(캡처 재실행 때 `DECLINED`·`PENDING` 표시가 사라짐)를 아침 전에 고칠지, 운영 규칙으로 둘지.** 사실: 지시서 6번은 캡처 응답 기준으로 충족한다. 재실행 경로는 T026 때부터 있던 "주문이 `COMPLETED`면 건너뜀" 분기와 지시서 6번의 "`captureId`가 있으면 다시 캡처하지 않는다"에서 나온다. 201 + `DECLINED`가 샌드박스 지갑 결제에서 실제로 오는지는 확인되지 않았다. 규칙으로 둔다면 위 순서 5번이 그 규칙이다.
2. **캡처 상태를 보여 주는 조회가 필요한지** (문제 2). 사실: `-- --status`와 `sandbox:check`는 주문 상태와 캡처 ID만 보여 준다. `sandbox:check`의 출력 꼴은 AC13이 읽는다.
3. **구현자 판단 2개를 그대로 둘지**: 캡처 `PENDING` 종료 코드 1, `sandbox:check`의 `--` 보호. 사실: 둘 다 지시서·기존 테스트와 충돌하지 않는다 (위 "구현자가 판단해서 넣은 것").
4. **`--fresh`가 살아 있는 `CREATED` 주문을 새로 만드는 동작** (d). 사실: 지시서 3번 문장대로다. 아침에 12건이 살아 있으면 `--fresh`를 쓰지 않는 것이 순서 1번이다.
