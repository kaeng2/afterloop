# T121c 보고 (2026-11-12 23:00)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/data / (커밋 후 `git log -1` 참조)

## 결과
완료. D1(지호)을 B3(품질)로 바꾸고, 딸린 문의를 시안 v6 지호 내용(소매 올 풀림)으로 맞췄다. AC17·AC29 포함 인수 테스트 전부 통과.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `seed/data.ts` (원본) | D1 subtype B1→B3. B02 문의(10/20 색상 불만, B1) → 11/09 "산 지 5주… 소매 올 풀림"(B3), 시안 v6 `ai.jiho.msg` 원문. B02 role 문구 품질 사건으로. O02 날짜는 그대로(10-15) |
| `seed/disputes.json`, `inquiries.json`, `buyers.json` | `npm run seed` 재생성 결과 |
| `tests/unit/seed.test.ts` | 위 변경에 맞춘 기대값 |

- 5주 전 구매·30일 반품 기간·Nov 19 기한은 `seed/demo-display.json`(jihoPurchase, Demo data)이 이미 갖고 있어 건드리지 않았다. O02 날짜를 10-06으로 바꾸면 시드 시험 "진행 중 분쟁 주문은 최근 4주 안"이 깨져 10-15로 두었다. 따라서 시드 주문일(10-15)과 문의 문구("5주")는 어긋나지만 화면은 jihoPurchase를 쓴다.
- 구매자 원문은 시드에 만들지 않았다(문의 시드 글은 기존처럼 isDemo 데모 문의).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (16 파일) | 0 | skipped 9 |
| npm test | 2753 | 25 | 아래 |
| npx tsc --noEmit | 실행 안 함 | | |

실패 25건은 `app-case-reply-retry`·`app-shared`·`app-t064-activity`·`app-t115`·`app-t122f`·`ops-t070-gates`·`seed-demo-display`·`storefront`. 확인한 것은 `config/demo-links.json`이 아직 지호 = PP-R-MBJ-10197650(MBJ)이라 시드/표시 값(ZOK)과 어긋나는 것(`seed-demo-display`: expected MBJ to be ZOK, `app-shared` 순서 비교, 지호 상세가 null). `config/`는 이 레인 수정 불가. `storefront` 100회 결정론은 5초 시간 초과(성능, 부하 영향 가능). 변경 전 상태와의 직접 비교는 하지 않았다.

## 남은 문제
- `config/demo-links.json` 지호를 ZOK으로 바꿔야 위 실패가 풀릴 것으로 보인다 (컨트롤 타워/권한).

## 컨트롤 타워에 요청할 결정
- `config/demo-links.json` 지호 항목 ZOK 반영 후 `npm test` 재실행 요청.
