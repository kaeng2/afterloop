# T011 보고 (2026-11-10)

- 기준 SPEC: v2.7 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/paypal-client / (커밋 직후 `git log -1`로 확인)

## 결과
완료. 추적번호 일괄 등록 서버 함수와 안전 장치(분쟁 제외, dry_run 기본, 허용 목록, 녹화 확인)를 가짜 클라이언트 단위 테스트로 확인했다. 실제 PayPal 호출 0회, `.env` 열지 않음.

## 화면(T016)이 부르는 방법
- `readTrackOrders()` → `{ orders, disputes }` (manifest 정적 import, 주문·분쟁을 항상 함께)
- `liveGateFromEnv(process.env, keys)` → `LiveGate` (서버 액션 한 곳에서만)
- `listUntracked(client, orders, disputes)` → 행 `{ key, orderId, state, excluded, disputeKeys?, note? }`
- `registerTrackers(client, { data, selectedKeys, live })` → `TrackBatchResult { results, mode, dryRun, counts, statusCodes }`. **지시서 초안의 `orders, disputes` 두 칸 대신 권장대로 `data`(readTrackOrders 결과) 한 덩어리**로 받는다.
- 건별: `{ dryRun, key, orderId, result, status, trackingNumber, note, virtualTracking: true }`. 화면에는 분쟁 번호를 내지 않는다 (`note`는 고정 사유 `분쟁 진행 중이라 제외`).

결과 상태 이름: 지시서 표와 같다 (`added`, `failed`, `skipped_already_tracked`, `excluded_dispute`, `not_allowed`, `dry_run`, `unknown_order`). `counts`에는 `unknown_order` 칸이 없다 (`results`로 본다).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/paypal/track.ts` | 정본 판정(`disputedOrderKeys`, `trackDisputedNote`, `isOrderUntracked`), `liveGateFromEnv`, `listUntracked`, `registerTrackers` |
| `src/paypal/track-orders.ts` | zod 스키마 + `readTrackOrders` (`tests/sandbox/manifest.json` 정적 import) |
| `tests/unit/track.test.ts` | 18개 단위 테스트 (가짜 클라이언트) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/unit/track.test.ts` | 18 | 0 | |
| `npm test` | 1468 | 0 | 28 파일 |
| `npx tsc --noEmit` | 통과 | | `resolveJsonModule` 켜져 있음 |
| `npm run lint` | 통과 | | 상대 경로 JSON import 문제 없음 |
| `npm run test:acceptance` | 155 | 0 | 9 skipped (기존) |

`git status`: 새 파일 3개만. `tests/sandbox/`·`scripts/`·`config/` 변경 0줄.

## 남은 문제 / 알림
- 복사본 두 곳이 생겼다: ① `scripts/sandbox/manifest.ts` 스키마 → `track-orders.ts` ② `hasTracker`/`errorSummary` → `track.ts`의 `isOrderUntracked`/`errorSummary`. 테스트가 manifest 스키마 동등성, 분쟁 키 집합, `trackDisputedNote`·`trackingNumberFor`·`trackRequestId`·`CARRIER_NAME_OTHER`, `hasTracker`와의 동작 일치를 묶는다. (`errorSummary` 동일성은 직접 묶지 않았다. 오류 노트 내용만 확인.)
- 클라이언트가 던진 오류는 `error.message`를 쓰지 않고 `name`·`status`·`debugId`만 싣는다 (스크립트의 `failureLine`보다 보수적).
- `listUntracked`의 분쟁 제외 행은 `state: 'unknown'` + `excluded: true`로 돌려준다 (GET 안 함).
- `liveGateFromEnv`의 `knownKeys` 인자는 선택이다. 화면이 `data.orders` 키를 넘기면 manifest에 없는 키를 걸러 낸다.
- 환경 변수 3개 이름·기본값 (`.env.example`은 컨트롤 타워가): `AFTERLOOP_TRACK_LIVE` 기본 꺼짐, `AFTERLOOP_TRACK_LIVE_ORDERS` 기본 `O03`, `AFTERLOOP_TRACK_RECORDING` 기본 꺼짐.
- 병합 뒤 O03 한 건 실호출 시험은 컨트롤 타워가 한다.

## 컨트롤 타워에 요청할 결정
없음
