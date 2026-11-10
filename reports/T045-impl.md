# T045 보고 (2026-11-10 11:07)

- 기준 SPEC: v2.5 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예** — `# SPEC v2.5 (2026-11-10 10:52 KST)`)
- 브랜치 / 마지막 커밋: `lane/data` / `1e1c05d`

## 결과

**완료.** 시연용 배송사 데이터 `seed/carrier-events.json`(7건)을 만들었다. 서연 주문 O01은 발송(10-18) → 이동 중(10-21) → 통관 보류(10-30, 원문 S5 예시 글 그대로, 배송 완료 없음), buyer_m 주문 O08은 발송(10-17) → 이동 중(10-19) → 배송 중(10-21) → 배송 완료(10-22)다. 전부 `isDemo: true`이고 그 밖의 주문에는 넣지 않았다. AC17 "시연용 배송사 데이터 (v2.5)" 5건이 통과하고, 인수 테스트 전체 실패가 0이다 (AC8은 T040이 이미 병합되어 통과한다). 기존 시드 JSON 5개는 한 글자도 바뀌지 않았다 (`git diff`에 나오지 않는다).

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `seed/carrier-events.json` (새 파일) | `npm run seed`가 쓴 배송사 이벤트 7건 (O01 3 + O08 4) |
| `seed/data.ts` | `carrierEvents` 원본 7줄 (날짜·글·순서 근거를 주석으로). `buildSeed()`가 `carrierEvents`를 함께 돌려준다 |
| `seed/schemas.ts` | `seedCarrierEventSchema`·`seedCarrierEventsSchema` (strict, 계약 8부와 양방향 Assert), 주문 맞물림 검사 `carrierEventProblems`(주문 존재 · 주문일 이후 · 주문마다 날짜 오름차순). `windowedDateSchema`를 라벨 받는 함수로 바꿔 오류 문구가 "주문일" / "배송사 이벤트 날짜"로 나뉜다 |
| `seed/generate.ts` | `carrier-events.json` 쓰기(zod 검증 후) + `carrierEventProblems` 실패 시 throw + 요약 한 줄. 머리글 SPEC 표기 v2.2 → v2.5 |
| `seed/index.ts` | `seedCarrierEvents: SeedCarrierEvent[]`(기존 export 방식 그대로 zod 검증), 편의 함수 `carrierEventsFor(orderId)` — 날짜순, 없는 주문은 빈 배열, 계산 없음 |
| `seed/README.md` | 파일 표에 한 줄 + "시연용 배송사 데이터" 절 한 문단 (PayPal 데이터가 아니라 시연용 · 분류 입력 `trackingEvents` · 서연 화면 "배송사 정보 반영 후" · buyer_m 배송 완료 기록, 주문별 흐름 표) |
| `tests/unit/seed.test.ts` | T045 단위 테스트 8건 + 결정성·개인정보 검사에 새 파일 포함 |

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 135 (+ 9 skipped) | 0 | AC17 "시연용 배송사 데이터 (v2.5)" 5건 모두 통과. 작업 전 같은 명령은 5 실패(그 5건, `carrier-events.json` 없음)였고 그 밖의 실패는 없었다 — AC8은 T040 병합으로 이미 통과 |
| `npm test` | 1081 (20 파일) | 0 | `tests/unit/seed.test.ts` 61건 (기존 53 + T045 8) |
| `npx tsc --noEmit` | 통과 | 0 | 출력 없음 |
| `npm run lint` | 통과 | 0 | 출력 없음 |
| `npm run seed` 2회 | 바이트 동일 | — | 두 번째 실행 후 `carrier-events.json` diff 없음. `git status`에 기존 JSON 5개가 나오지 않는다 |

T045 단위 테스트 8건: ① 스키마 통과 + 주문 2건·7행·전부 `isDemo: true` ② 주문·날짜·상태가 지시서 표와 같고 통관 보류 글이 원문 S5 예시 그대로 ③ `carrierEventProblems`가 깨끗(주문일 이후, 창 안) ④ O01은 통관 보류로 끝나고 배송 완료 없음, 발송일이 10-17~10-19 ⑤ `carrierEventsFor('O01')`의 `text`를 `ClassifyInput.trackingEvents`에 넣으면 `customs hold`가 들어 있다 (SPEC 4장 규칙 4 → A2. 분류기를 import하지 않고 글자만 본다) ⑥ O08은 배송 완료로 끝나고 그 날짜가 buyer_m의 10/28 문의보다 앞 ⑦ 이벤트 없는 주문·없는 주문 ID는 빈 배열 ⑧ `seedCarrierEvents`가 파일 그대로.

`git diff main --stat`: `seed/` 6개 + `tests/unit/seed.test.ts`뿐 — 수정 가능 폴더 밖 변경 0.

## 남은 문제

- `seed/index.ts`가 `./carrier-events.json`을 import하므로 이 파일이 저장소에 있어야 `tsc`가 통과한다. 기존 시드 JSON 5개와 같은 방식이라 생성 결과를 커밋했다 (`npm run seed`로 언제든 같은 바이트로 다시 만들 수 있다).
- 배송사 글은 "배송사가 쓸 법한" 영어 한 줄을 우리가 적은 것이다 (실제 배송사 문구가 아님). SPEC 10장의 'Demo data' 배지와 README 정직성 표에 기대고 있다.

## 컨트롤 타워에 요청할 결정

- 없음.
