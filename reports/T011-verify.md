판정: 통과

# T011 독립 검증 (추적번호 일괄 등록)

실제 PayPal 호출 0회, `.env` 열지 않음. 가짜 클라이언트(받은 모든 get/call의 method·path·requestId 기록)로만 시험. 탐침: scratchpad `t011-verify/probe.mts`, `cmp.mts` (저장소 밖).

## 범위
`git diff main...HEAD --stat`: `reports/T011-impl.md`, `src/paypal/track.ts`, `src/paypal/track-orders.ts`, `tests/unit/track.test.ts` 4개만 (+673). `tests/sandbox/`·`scripts/`·`config/`·`src/types.ts`·`.env.example` 변경 0줄. 범위 위반 없음.

## 실행
| 명령 | 결과 |
|---|---|
| `npm test` | 28 파일, 1468 통과, 0 실패, 종료 0 |
| `npx tsc --noEmit` | 종료 0 |
| `npm run lint` | 종료 0 |
| `npm run test:acceptance` | 155 통과, 9 skipped, 0 실패, 종료 0 |

## 스위치 조합 (실제 manifest, 주문 13건 전부 선택, GET/POST는 가짜 클라이언트가 받은 횟수)
| 조합 | GET | POST 대상 | 비고 |
|---|---|---|---|
| 전부 꺼짐(기본) | 0 | 없음 | mode=dry_run, dryRun=true, 건별 dry_run 8건·status null·`Dry run — no call was made`, 분쟁 5건 excluded |
| LIVE=1만 | 1 | O03만 | O05·O07 not_allowed, POST 0 |
| LIVE=1 + LIVE_ORDERS=O03,O05,O07, 녹화 꺼짐 | 1 | O03만 | `liveGateFromEnv`가 O05·O07을 허용 목록에서 뺌 (allowed=[O03]) |
| 세 개 모두 + LIVE_ORDERS=O05,O07 | 2 | O05, O07 | O03은 not_allowed (호출 0) |
| 세 개 모두 + LIVE_ORDERS 없음 | 1 | O03만 | 녹화 확인만으로 O05·O07이 열리지 않음 |
| 녹화=1 + LIVE_ORDERS=O05, LIVE 꺼짐 | 0 | 없음 | dry_run |
| 분쟁 5건(O01·O02·O04·O08·O13)만 선택, 꺼짐/LIVE/세 개+분쟁 키를 LIVE_ORDERS에 직접 | 0 | 없음 | 전부 excluded_dispute, note `분쟁 진행 중이라 제외` |
| 게이트를 손으로 만들어(allowedKeys에 분쟁 키, recording=true) 직접 전달 | 0 | 없음 | excluded_dispute |
| 게이트를 손으로(allowedKeys=O05,O07,O03, recording=false) 전달 | 1 | O03만 | O05·O07 not_allowed (`registerTrackers` 이중 확인 동작) |
| 가짜 manifest에 O03을 가리키는 분쟁 추가 | 0 | 없음 | O03 excluded_dispute (판정이 manifest 분쟁을 따라감) |
| 가짜 manifest에서 P1(O04) 제거 | 1 | O04 | 분쟁 목록 의존이 맞음 (분쟁 목록이 `data.disputes`에서 옴) |
| 이미 추적 있는 주문(O03) | 1 | 없음 | skipped_already_tracked |

분쟁 목록은 `data.disputes` 전부(demoExcluded 포함)에서 오며 필터가 없다. 실제 manifest의 시연 제외 D2-old(O01)·P1(O04)도 막힘.

## 스위치 값 해석표 (`liveGateFromEnv`)
| 입력 | 해석 |
|---|---|
| LIVE = `0`, `false`, ` `, `TRUE`, `true`, `yes`, `01`, 빈 문자열, `1 `, ` 1` | 전부 꺼짐 (정확히 `"1"`만 켜짐) |
| RECORDING = `0`,`false`,` `,`TRUE`,`yes`,`1 ` | 전부 꺼짐 → O05 허용 목록에서 빠짐 |
| LIVE_ORDERS = ` O03 , O05 ` (녹화 켬) | [O03,O05] (공백 정리) |
| `o03` | [O03] (대문자화) |
| `O99`, `O3`, `O 03`, `O03;O05` | knownKeys를 주면 [] (없는 키 무시). 안 주면 쓰레기 문자열이 목록에 남지만 어느 주문과도 일치하지 않아 호출 없음 |
| `O03,,O05` | [O03,O05] (빈 항목 무시) |
| 빈 문자열, 공백만 | 기본 [O03] |
| `,` (쉼표만) | [] (아무것도 허용 안 함, 안전 쪽) |
| `o05` / `O03,O05` + 녹화 꺼짐 | [] / [O03] |
| `NEXT_PUBLIC_AFTERLOOP_TRACK_LIVE=1`, `AFTERLOOP_LIVE`·`AFTERLOOP_SEND_LIVE` | 무시 (꺼짐). 다른 스위치와 분리됨 |

꺼야 할 값이 켜짐으로 읽히는 경우 없음.

## 일부 실패·비밀값
- O03 POST 422, O05 클라이언트 예외, O07 정상: 세 건 모두 처리 → failed(422, note `UNPROCESSABLE · ISS · debug_id=d2`), failed(500, `호출 실패 · Error · 500 · debug_id=dbg1`), added(200). GET 던짐/POST 500 조합도 나머지 계속. 건당 호출은 GET 1·POST 1뿐, 같은 실행에서 재호출 없음 (재시도는 실제 클라이언트 쪽 몫).
- 가짜 응답·예외 메시지에 넣은 표식(`SECRETTOKEN`, `PIIEMAIL@x.com`, `Bearer`, `Authorization`, `client_secret`, 배송지 표식, 구매자 이름 yuki·lena)이 결과 JSON에 0건. 예외는 message를 쓰지 않고 name·status·debugId만.
- POST 경로 `/v2/checkout/orders/{id}/track`, `/v1/` 경로 0건, `disput` 경로 0건. requestId `afterloop-track-O03`·`O05`, 두 번 실행해도 동일. 본문: capture_id(manifest 값), tracking_number `FKAL032026`, carrier OTHER, carrier_name_other `Fernwood Knits demo carrier`, notify_payer false.
- 중복 키는 한 번, 없는 키(`O99`, `o03`)는 unknown_order·호출 0, 빈 목록은 빈 결과.

## 주문 목록 읽기
- `track-orders.ts`가 `import manifestJson from '../../tests/sandbox/manifest.json'` 정적 import. `readFileSync` 없음 (grep 확인).
- zod 스키마 있음. 실제 manifest(주문 13, 분쟁 5) 통과. `null`·`{orders:[{key:'O1'}]}`·`{orders:'x'}` 거부.
- 테스트(`track.test.ts`)는 `scripts/sandbox/manifest.ts`·`paypal.ts`(hasTracker)·`setup-steps.ts`를 실제로 import해 비교한다 (import 줄 확인).

## 가상 추적번호
`trackingNumberFor`(FKAL+숫자 2자리+2026)·`trackRequestId`·`CARRIER_NAME_OTHER`는 스크립트와 같은 식 (테스트가 스크립트 함수와 비교). 모든 건별 결과에 `virtualTracking: true`.

## 구현 보고서 대조
- "`errorSummary` 동일성은 직접 묶지 않았다": 맞다 (테스트에 직접 비교 없음). 내가 직접 비교: 스크립트 `errorSummary`와 `track.ts` 내부 `errorSummary`는 본문이 글자 그대로 같고, 9가지 본문(null, {}, 문자열, 배열, name만, error+details 혼합/빈 issue, name+debug_id+message, details가 문자열, 숫자 name)을 `registerTrackers` note로 통과시켜 스크립트 결과와 9/9 일치. (함수가 export되지 않아 note를 통해서만 비교.)
- 나머지 주장(18개 테스트, 숫자 1468/155, 변경 파일 3개, 결과 상태 이름)은 모두 사실과 일치. 사실과 다른 주장 없음. "마지막 커밋"은 비어 있음(구현 보고서 자체의 빈칸, 기록만).

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정: 없음.
- 기록만:
  1. `readTrackOrders({})`는 빈 주문·빈 분쟁을 받아들인다 (`orders`·`disputes`에 `.default([])`). 스크립트의 `ManifestSchema`도 같은 동작이라 동등성은 유지되나, 기본 source는 실제 manifest라 현재 위험은 없다.
  2. `registerTrackers`는 호출자가 준 `data.disputes`를 믿는다. 지시서가 권장한 대로 `readTrackOrders()` 결과를 통째로 넘겨야 한다 (T016이 지켜야 할 점). 이 경우 O02를 빈 분쟁 목록으로 넘기면 등록 대상이 된다 (탐침으로 확인).
  3. 스위치가 꺼진 dry_run에서는 허용 목록을 보지 않아 O05·O07도 `dry_run` 결과(가상 번호 포함)가 나온다. 호출 0회라 안전하고, 지시서 문구(꺼짐 = dry_run)와도 맞다.
  4. `liveGateFromEnv`의 `knownKeys`는 선택이라 안 주면 존재하지 않는 키 문자열이 허용 목록에 남는다 (무해).
  5. 구현 보고서의 "마지막 커밋" 칸이 미기재.

## 확인하지 못한 것
- 실제 PayPal 호출은 하지 않았다 (실제 `/track` 응답 모양, 실제 클라이언트의 재시도·429 처리와의 상호작용은 미확인. O03 실호출 시험은 병합 뒤 컨트롤 타워 몫).
- 화면(T016)과 서버 액션이 `liveGateFromEnv`를 올바르게 부르는지는 이 범위 밖.
- 실제 `createPayPalClient`가 던지는 예외의 모양(`status`, `debugId` 필드)과 이 코드의 가정이 맞는지는 가짜 예외로만 시험.
