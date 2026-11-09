# T002 보고 (2026-11-09 21:35)

- 기준 SPEC: v2.1 (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `# SPEC v2.1 (2026-11-09 21:02 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal-client / `2f54eda` (이 보고서 커밋은 그 뒤)
- 작업 폴더: `afterloop-wt/paypal-client` (worktree, `pwd` 확인)

## 결과
완료 — `createPayPalClient` 하나로 토큰 재사용·401 1회 갱신·429/5xx·네트워크 재시도·분당 30회 속도 제한·PayPal-Request-Id·샌드박스 전용·비밀값 비노출을 모두 처리한다. AC14 14개와 단위 테스트 22개가 모두 통과하고, 실제 PayPal 호출이나 실제 시간 대기는 없다 (`deps.fetch` / `deps.now` / `deps.sleep`만 사용).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/paypal/client.ts` (새 파일) | `createPayPalClient(env, deps)`. 토큰 발급·재사용, 401·429·5xx·네트워크 재시도, 60초 30회 속도 제한, POST 헤더·본문, 응답 파싱, 샌드박스 baseUrl 검사, 로그·에러 비밀값 가리기 |
| `tests/unit/client.test.ts` (새 파일) | 단위 테스트 22개. 가짜 `fetch`·`now`·`sleep`만 주입 |

수정 가능 폴더 밖은 건드리지 않았다 (`src/types.ts`, `tests/acceptance/`, `scripts/sandbox/`, `src/exec/`, `config/` 모두 그대로).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | 완료 기준 AC14 |
| `npm run test:acceptance` | 41 | 2 (+ 3 파일 수집 실패, 9 skip) | 모두 **다른 작업** 몫. 아래 참고 |
| `npm test` (tests/unit) | 88 | 0 | 이 중 `client.test.ts` 22개가 이번 작업 |
| `npx tsc --noEmit` | — | 3 | 모두 다른 작업의 미구현 모듈. 내 파일 오류 0 |
| `npx eslint src/paypal/client.ts tests/unit/client.test.ts` | — | 0 | |

이번 작업과 무관한 기존 실패 (건드리지 않음):
- `ac04.plan.test.ts` → `@/engine/plan` 없음 (T005)
- `ac07.escalation.test.ts` → `@/engine/escalation` 없음 (T006)
- `ac11-12.exec.test.ts` → `@/exec/execute` 없음 (T008)
- `ac13.sandbox.test.ts` 2건 → `.env.example` 없음 / `.gitignore` (T001)
- `npx tsc --noEmit`의 3개 오류는 위 세 모듈 부재와 같은 원인이다.

## 설계 메모 (지시서 표 ↔ 구현)
| 지시서 항목 | 구현 |
|---|---|
| 첫 호출 / 재사용 | `POST /v1/oauth2/token`(Basic, `grant_type=client_credentials`). `deps.now() < expiresAt - 60_000`이면 재사용 |
| 401 | 토큰을 버리고 1회만 새로 받아 같은 `init`(= 같은 요청 ID·본문)으로 재시도. 또 401이면 에러 |
| 429 | `Retry-After`초(숫자가 아니거나 없으면 30초) `deps.sleep` 후 재시도, 최대 2회 (호출 3회) → 에러 |
| 5xx·네트워크 | 2초 → 4초 후 재시도, 최대 2회 |
| 속도 제한 | 최근 60초 호출 시각을 담아 두고 30회를 넘으면 가장 오래된 호출이 창을 벗어날 때까지 `deps.sleep` |
| POST | `PayPal-Request-Id`, `Content-Type: application/json`. 재시도는 같은 `init`을 다시 보내므로 값이 같다 |
| 응답 | `{ status, body }`. 빈 본문 null, JSON이 아니면 원문 문자열 |
| baseUrl | `https://api-m.sandbox.paypal.com`만 허용 (끝 슬래시만 허용). 아니면 생성 시 에러, 호출 0회 |
| 비밀값 | 로그·에러 문구는 모두 `redact`를 지난다 (Secret, Basic 값, 받은 모든 액세스 토큰 → `[redacted]`). 요청·응답 본문은 로그에 남기지 않는다 (구매자 개인정보, SPEC 10장) |
| 시간 | `Date.now`·`setTimeout`·`setInterval`을 쓰지 않는다 (단위 테스트가 소스를 검사한다) |

지시서 표가 정하지 않아 **판단한 것 3가지** (계약 변경은 아니다. 다르게 원하면 알려주면 바꾼다):
1. **재시도를 다 쓴 5xx·네트워크 오류는 에러로 던진다** (429와 같은 처리). 표는 429만 "그래도 429면 에러"라고 적어 5xx 소진 후를 정하지 않았다. 호출한 쪽이 상태를 볼 수 있게 에러에 `status`(네트워크 오류는 `null`)와 `path`를 달아 둔다. 401·429·5xx가 아닌 상태(404·422 등)는 에러로 만들지 않고 `{ status, body }`로 그대로 돌려준다 — T008이 `ExecuteResult`로 옮길 수 있게.
2. **토큰 발급 호출도 60초 30회 창에 센다** (PayPal로 나가는 실제 호출이므로). AC14의 속도 제한 테스트는 세는 쪽·안 세는 쪽 모두 통과한다.
3. **POST의 `requestId`가 빈 문자열이면 호출 전에 거부한다** (중복 실행 방지 장치가 빠진 호출을 내보내지 않기 위해). 동기로 던지지 않고 거부된 Promise로 돌려준다.

속도 제한·재시도 간격·토큰 조기 갱신 시간은 SPEC 9-2에서 정한 기술 상수라 `src/paypal/client.ts` 맨 위 상수로 두었다 (`config/`는 가정값·정책 기준값·문구용이고 이 레인이 수정할 수 있는 폴더도 아니다).

## 남은 문제
- 실제 샌드박스 호출로 확인한 적은 없다 (`.env` 없음, 지시서 범위 밖). 토큰 응답 모양(`access_token`, `expires_in`)과 429 `Retry-After`가 실제와 같다고 가정했다. 첫 실호출은 T001/T003에서 확인된다.
- `Retry-After`가 HTTP 날짜 형식으로 오면 해석하지 않고 30초 대기로 떨어진다 (샌드박스는 초 단위로 보낸다고 가정).
- 분쟁 API 함수·mapper(T003), 실행 로직(T008), `scripts/sandbox/check.ts` 교체(T003)는 지시서대로 하지 않았다.
- 상위 폴더의 Python 실습 `paypal_client.py`는 worktree 밖이라 권한 제한으로 열지 못했다. 지시서 표만 기준으로 구현했다 (표가 기준이라고 적혀 있어 작업에 지장은 없었다).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC을 바꿀 필요가 없었다). 위 "판단한 것 3가지"만 확인해 주면 된다.
