# T121 보고 (2026-11-12)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/data / (아래 커밋 해시는 커밋 후 `git log -1`)

## 결과
완료. 시안 v6 표시용 시드를 새 파일 `seed/demo-display.json`(소스 `demo-display.ts`, 스키마 `demo-schema.ts`)로 만들고, Nov 2 서연 문의 문장만 시안 문장으로 바꿨다. AC17이 잠근 JSON(`products·buyers·disputes·orders`)과 서연 Nov 9 문의 원문은 건드리지 않았다. 실제 AI 호출·서버·`.env` 읽기 없음.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `seed/demo-display.ts` (새) | 표시용 데이터 소스. 서연 기록 8줄(en·ko, 시안 histT 그대로), 표시용 주문 번호 #1042/#1038/#1047 + PP-R-… `paypalRef`, 상품·손님 표기(pname·who), 예방 줄 2개(5·3건, `realTrackingTargets`는 O05·O07만), 데모 항목 Lena #1029·Yuki #1051, 지호 구매일(2026-10-06, 5주 전)·반품 30일 |
| `seed/demo-schema.ts` (새) | zod 스키마(strict) + `demoDisplayProblems`(시드와의 맞물림 검사) |
| `seed/demo-display.json` (새) | `npm run seed`가 만든 결과 (결정적) |
| `seed/generate.ts` · `seed/index.ts` | 위 파일 생성·검증, `seedDemoDisplay` 내보내기 |
| `seed/data.ts` · `seed/inquiries.json` | Nov 2 서연 문의 → ko "배송 조회가 일주일째 그대로예요. 확인해 주실 수 있나요?" / en "Tracking hasn't moved in a week. Could you check?" |
| `tests/unit/seed.test.ts` | Nov 2 문장 기대값 갱신 |
| `tests/unit/seed-demo-display.test.ts` (새) | 17개: 8줄 문장·날짜, 칩은 `bad` 줄에만, Nov 9는 `source:'paypal'`·접수 줄 없음, 번호·PP-R(`config/demo-links.json`과 대조), 예방 줄·실제 대상 O05·O07(미등록 확인), Lena·Yuki, JSON=소스, 이메일·통관번호 값 없음 |

## 데이터 해석 (확인 필요한 것)
- **Nov 2 "첫 메시지"**: 시안 Nov 2 줄("She asked again: tracking hasn't moved in a week.")에 맞춰 Nov 2 시드 문의를 바꿨다. Oct 28 "Where is my order?"는 시드 문의 건수(AC17: 31건)를 늘릴 수 없어 `seoyeonHistory`에만 있다.
- **마이크 #1047 상품**: 시안은 스웨터인데 시드 주문 O08은 비니 세트다. 화면 표기용 `displaySku`는 시안(스웨터)을 따르고 `orderId: 'O08'`은 그대로 뒀다. 가격·판정은 엔진·실제 값이 쓴다는 전제. 화면 작업이 스웨터 $72와 O08 실제 값 중 어느 쪽을 쓸지 정해야 한다.
- 서연 기록 8줄에는 분쟁 접수 줄이 없다(시안도 8줄). 접수 줄은 실제 PayPal 값이 만든다. Nov 9 줄은 `source:'paypal'`로 표시했다.
- 위험 %·"Keeps ≈$N"·기대 손실은 넣지 않았다 (엔진).
- 지호 #1038은 `paypalRef: null`, `seedDisputeId: null` (demo-links는 T119 뒤 컨트롤 타워 지시). 기존 D1(PP-R-MBJ-10197650)은 그대로다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `vitest run tests/unit/seed.test.ts tests/unit/seed-demo-display.test.ts` | 77 | 0 | |
| `npm run test:acceptance` | 179 (+9 skip) | 3 | AC17 전부 통과. 실패 3건은 모두 `ac35.repair-offer` (repair 엔진, T120 범위 — 이 레인 밖) |
| `npx tsc --noEmit` | — | 오류 4 | `src/app/cases/{model.ts,reply/load.ts,view/load.ts}`의 `repair` 타입 미반영 (T120·T122 범위, 내 변경과 무관) |

## 남은 문제
- AC35 실패·tsc 오류는 engine/ui 레인 작업 대기 상태로 보이며 시드와 무관하다.

## 컨트롤 타워에 요청할 결정
- 마이크 #1047의 화면 상품(시안 스웨터 vs 실제 시드 비니)을 T122에서 어느 쪽으로 할지.
