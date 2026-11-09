# SPEC v2.2 (2026-11-09 22:31 KST)

> **계약 변경 규칙.** 이 문서, `src/types.ts`, `tests/acceptance/`는 계약이다. 바꿔야 하면 컨트롤 타워가 변경 내용·이유·영향받는 작업을 `DECISIONS.md`에 먼저 적고, 사람이 승인한 뒤에만 바꾼다. 바꿀 때마다 위 버전을 올린다. 작업 세션은 이 세 곳과 `DECISIONS.md`, `TASKS.md`, `tasks/`를 고치지 않는다 (`.claude/settings.json`에서 편집이 막혀 있다).

## 0. 기준 문서
- 원문: `inbox/2026-11-09-prd-v2.md` (Fernwood Knits 버전). 이 SPEC에서 "원문 N장"은 이 파일의 장 번호다.
- 검토: `inbox/2026-11-09-prd-v2-review.md`. **원문과 충돌하면 검토 파일이 우선**한다 (M1~M9).
- 이 SPEC은 둘을 합친 결과다. 셋이 다르면 SPEC > 검토 > 원문 순서.
- v2.1 (2026-11-09): 분쟁 수수료 f 800¢ → 1500¢ (`inbox/done/2026-11-09-dispute-fee.md`), 샌드박스 주문 스크립트 경로 추가 (11장). 나머지는 v2 그대로.
- v2.2 (2026-11-09): 제안 금액 반올림 문구 (5장, Q9), 시드 계약 필드 `SeedDispute.orderId`·`SeedOrder.date`와 종결 손실 기준 (12장, Q8·Q10), 시뮬레이션 숫자는 계산 결과 사용 (8장, Q4). 인수 테스트 AC17 추가.
- 미확정 항목은 13장. 임시값으로 진행한다.

## 1. 제품 한 줄
해외 구매자에게 파는 소규모 판매자를 위한 PayPal 구매 후 코파일럿. 상품별 분쟁 위험을 진단하고(S2), 처방을 PayPal API로 실행해 분쟁을 미리 막고(S3), 터진 분쟁은 구매자 언어로 합의 단계에서 끝내게 돕는다(S5). 데모 페르소나: 미국 1인 니트 브랜드 Fernwood Knits의 Hannah (화면은 영어, 한국어 구매자 대응이 데모 포인트).

## 2. MVP 범위 (원문 7장 + 검토 M7)
| 화면 | 이름 | 범위 | 대표 장면 | 실제 API |
|---|---|---|---|---|
| S1 | Today | 가벼움 | SC1 브리핑, 예상 손실 합계 | 조회 |
| S2 | Product check | 핵심 | SC2 리허설(500회 시뮬레이션), AI 색상 문구 | Transaction Search |
| S3 | At-risk orders | 핵심 | SC3 추적번호 일괄 등록, 한국 통관 안내(P1), Lena 환불(P1) | Orders v2 `/track`, 주문 상세 |
| S4 | Inbox + Autopilot | 가벼움 | SC5 오토파일럿 판정과 로그 (**P0 가벼운 버전**: 웹훅 없이 [Run autopilot] 또는 분쟁 목록 조회) | Disputes GET |
| S5 | Case | 핵심 | **SC4 서연(대표 시나리오)**: 원인 파악, 확대 위험, 코칭, 한국어 답장 | Disputes GET, send-message |

- 실호출 4종 (성공 지표): 분쟁 조회, 추적번호 등록, 메시지, 거래 조회(Transaction Search). 환불은 P1.
- 로드맵 (만들지 않음): 택배사 비교, 정책 설정 화면, 원인 분석 리포트, 기한 타임라인, 부분 환불 제안 UI, 재발 예방(원문 10-7).
- P1: 환불 실행(F11), 한국 통관 안내(F12), 웹훅(원문 13장 12·13번), provide-evidence, make-offer 실행(오토파일럿 승인 후).

## 3. 생성과 판정 (원문 3장 설계 원칙)
| AI가 한다 (제안) | 코드가 한다 (판정) |
|---|---|
| 세부 유형 분류(규칙에 안 걸린 것), 원인 설명 | 규칙 우선 분류, 확신도 기준 |
| 번역, 코칭 답장 구조, 색상 문구, 통관 안내, FAQ 답변 문장 | 기대 손실, 확률, 금액, 절감액, 시뮬레이션 |
| 화난 어조 판별 (확대 위험 신호 1개) | 확대 위험 점수, 오토파일럿 판정, 실행 여부 |
| | 토큰 검사(사실값 일치), 새 약속 차단 |

- **사실값은 LLM이 쓰지 않는다** (검토 결정 4): 날짜·금액·추적번호·통관 상태는 모든 AI 초안(코칭 답장, 색상 문구, 통관 안내, 자동 답변)에서 `⟦DATE_1⟧`·`{{offerAmount}}` 같은 토큰으로만 쓰고 코드가 채운다. 토큰 개수·값이 다르면 전송 불가.
- 모델 호출은 서버에서만. 프롬프트에 구매자 이메일·주소·개인통관고유부호를 넣지 않는다. 응답은 JSON 스키마로 받고, 실패하면 "AI unavailable — showing rules only".
- 화면에는 `AI suggests`(보라)와 `Code decides`(회색) 배지를 나란히 둔다.

## 4. 원인 분류 (원문 5장, 10-1 + 검토 M3·M5)
- 6개 대분류 · 16개 세부 유형: A1~A4, B1~B5, C1~C3, D1, E1, F1, F2 (`types.ts`의 `Subtype`).
- **규칙 먼저** (코드):
  1. reason `UNAUTHORISED` → E1
  2. 같은 구매자의 이전 미수령 분쟁 2회 이상(이번이 3번째 이상) + 배송 완료 기록 → F1 (M5)
  3. 추적번호 없음 + INR → A1
  4. 추적 이벤트에 customs hold → A2
- 그 외는 LLM이 16개 중 하나 + 확신도 + 근거 단어. 확신도 < 0.7이면 `needsReview` ("Check type" 배지).
- A·B·C는 예방 중심, E·F는 증빙 중심. E1 예방 조치는 주문 보류가 아니라 "서명 배송, 청구지와 다른 배송지면 판매자에게 확인 알림" (M6).

## 5. 기대 손실 (원문 10-3 + 검토 M1)
기호: A 분쟁 금액, p_win 다퉜을 때 이길 확률, f 분쟁 수수료, t 대응 시간 비용, x 제안률, p_acc 수락률

- L_fight = (1 − p_win)(A + f) + t
- L_offer = p_acc·x·A + (1 − p_acc)(1 − p_win)(A + f) + t (거절되면 다투기로 가지만 t는 한 번만)
- L_refund = A + t
- 기본값 (`config/params.json`): f = 1500¢, t = 200¢, x = 0.15(정책 고정, 최적화하지 않음), p_acc = 0.72
- f는 PayPal 미국 Standard Dispute Fee 15.00 USD (source "PayPal", https://www.paypal.com/webapps/mpp/merchant-fees). **질 때만 부과**한다 (위 식 그대로). 합의 단계에서 해결되거나 제안이 수락되면 면제이므로 L_offer의 수락 분기와 L_refund에는 f가 없다 (13장 Q7)
- p_win: 세부 유형별 기본값, 추적 등록(배송 기록)이 있으면 별도 값 (A1·A3·A4·F1 0.15 → 0.80, A2 0.30 → 0.60, 원문 9-1). B1 0.30.
- **제안은 색상·사이즈(B1, B2)만** 평가한다. 그 외는 `blockedBy: 'OFFER_SCOPE'`, `expectedLossCents: null`.
- 재구매 가치 V, 이탈 확률 c, p_acc 곡선은 쓰지 않는다 (v1에서 삭제. 13장 Q1).
- **금액은 센트 정수** (검토 결정 5): 계산식을 그대로 푼 뒤 마지막에 센트로 사사오입. 화면 표시만 달러로 반올림.
- **제안 금액 x·A는 센트로 반올림(사사오입)한 뒤 식에 넣는다** (v2.2, Q9). 실제로 보내는 제안 금액(`ActionPlan.amountCents`)과 L_offer·트리 분기에 쓰는 금액이 같은 값이어야 한다. 그래서 x·A가 정수 센트가 아닌 금액에서는 "식을 그대로 푼 값"과 1¢까지 다를 수 있다.
- 동점이면 fight → offer → refund.
- 최소 기대 손실 수가 추천(`best`). 실행은 항상 판매자 승인 후.

### 수 → API
| 수 | apiMove | 조건 |
|---|---|---|
| fight | `provide_evidence` | 허용될 때 (P1) |
| fight | `send_message` | `provide_evidence`가 없고 `send_message`가 허용될 때 (합의 단계, 증빙 안내 메시지) |
| offer | `make_offer` | 허용 + B1·B2 |
| refund | `accept_claim` | 허용될 때 |

대응할 API가 `allowedMoves`에 없는 수는 `all`에서 뺀다. 남는 수가 없으면 `best = null` ("직접 처리").

## 6. 정책과 오토파일럿 (원문 10-6 + 검토 M7, 값은 `config/rules.json`)
- 제안률은 정책값 0.15, 판매자 한도 0.20. 한도를 넘는 제안률은 설정 오류(zod 에러).
- 오토파일럿 판정 (코드, 순서대로 첫 번째로 걸리는 규칙):

  | 순서 | 조건 | 판정 | 규칙 이름 |
  |---|---|---|---|
  | 1 | 원인 대분류 F (악용 의심) | `skipped` | `suspected_abuse` |
  | 2 | `channel = 'EXTERNAL'` (카드사 분쟁) | `skipped` | `card_company_case` |
  | 3 | 확신도 < 0.7 또는 원인 없음 | `skipped` | `low_confidence` |
  | 4 | `best`가 돈이 움직이는 수 (offer, refund) | `awaiting_approval` | `money_moves` |
  | 5 | 그 외 분쟁 (`best`가 fight 또는 없음) | `awaiting_approval` | `seller_review` |
  | — | 분쟁이 아닌 자주 묻는 질문 (사이즈표·배송·통관 안내) | `auto` | `common_questions` |

- 분쟁에 대해서는 자동 실행이 없다. 실제로 자동 실행되는 것은 FAQ 답변뿐이고, 데모에서는 이메일을 시뮬레이션한다.
- 모든 판정은 규칙 이름과 함께 로그에 남긴다.

## 7. 확대 위험 점수 (원문 10-4 + 검토 M4)
| 신호 | 점수 |
|---|---|
| 은행·카드사·chargeback 언급 ("카드사", "이의제기" 포함) | +3 |
| 무응답: 두 번째 문의에 무응답 **또는** 24시간 넘게 무응답 (**둘 중 하나만**) | +2 |
| 화난 어조 (LLM 판별. 판매자가 답장한 뒤에는 구매자의 다음 메시지가 올 때까지 0) | +1 |
| 응답 기한 72시간 이내 | +1 |

- 0~2 Low · 3~4 Watch · 5 이상 High.
- 서연 건 (시연 시점 11/10 17:00Z, 기한 11/12 17:00Z = 48시간): 시작 3 + 2 + 1 + 1 = **7 (High)** → 답장 후 3 + 0 + 0 + 1 = **4 (Watch)**. (13장 Q2: 임시값)

## 8. 상품 진단 시뮬레이션 (원문 9장)
- 미래 500개 × 재고 수 × 세부 유형. 상품별 시드로 난수를 한 번 만들고, Before·After가 같은 난수를 쓴다 (common random numbers). 같은 입력이면 항상 같은 결과.
- 주문마다 세부 유형 순서대로 `난수 < 기본 확률 × 처방 배수`이면 분쟁 (주문당 최대 1건).
- 분쟁마다 대응: 지금 습관 = 50% 전액 환불 / 50% 다투기, 합의 우선 정책 = 5장 기대 손실이 가장 작은 수.
- 처방 배수 (`config/params.json`): 추적 24시간 내 등록 A1 ×0.25 + 배송 분쟁 p_win 상향, 색상 고지 B1 ×0.4, 한국 통관 안내 A2 ×0.5, 합의 우선 정책.
- 출력: 평균 손실, P10~P90, 평균 분쟁 수, 손실 분포, 처방별 폭포.
- 모든 화면의 예상 손실은 이 함수 하나에서 나온다 (원문 F3). **화면·문서의 숫자는 PRD 값($195/$43, $481/$143 등)을 하드코딩하지 않고 이 함수의 결과를 쓴다** (v2.2, Q4 확정). 난수 생성기와 시드는 우리 구현이 정한다.

## 9. 실행과 PayPal 연동
### 9-1. 실행 (`executeMove`, v1.1 그대로)
- `approval`이 없거나 `planId`가 다르면 호출 전에 거부. `apiMove`가 허용되지 않으면 거부. `accept_claim`은 `confirmAcceptClaim === true`일 때만.
- 한 계획에 PayPal 호출은 1회: `make_offer` → make-offer (메시지는 `note`), `send_message` → send-message, `accept_claim` → accept-claim, `provide_evidence` → 아직 실행하지 않음 (P1).
- 메시지 토큰을 `plan`·`board` 값으로 채운다. 메시지 안 금액 = API 본문 금액.

### 9-2. PayPal 클라이언트 (`createPayPalClient`, v1.1 그대로)
토큰 재사용, 401 1회 갱신, 429·5xx 재시도, 분당 30회, PayPal-Request-Id, 샌드박스만, 비밀값 비노출. 서버 코드에서만 쓴다.

### 9-3. 추적번호 (검토 M3, 결정 6)
- 미등록 판정: 주문 상세 `GET /v2/checkout/orders/{id}`의 추적 정보.
- 등록: 주문별 `POST /v2/checkout/orders/{id}/track` 반복 호출. 화면에는 건별 결과를 묶어서: "✓ 5 trackers added · POST /v2/checkout/orders/{id}/track × 5 · 200" + 행마다 추적번호, 실패 건은 행별 오류.
- `/v1/shipping/trackers*`는 쓰지 않는다 (지원 중단, 이 앱에서 403).

### 9-4. 그 밖의 API (원문 13장 + 검토)
- 분쟁 목록·상세, send-message: P0 실호출.
- Transaction Search (`GET /v1/reporting/transactions`): P0, 몇 시간 늦게 반영될 수 있어 캐시 ('cached' 배지).
- 장면 3·5의 입력은 "웹훅(P1) 또는 분쟁 목록·상세 조회" (M7).
- 앱 설정에서 'Customer disputes'와 'Transaction search'를 모두 켠다 (반영 최대 10분, M8).

### 9-5. 샌드박스 구성 (검토 M8)
- 비즈니스 US 1개 (Fernwood Knits) + 개인 5개: 서연 KR, 지호 KR, Yuki JP, Lena DE, buyer_m US.
- 한국 개인 계정이 샌드박스 결제에 막히면 US 개인 계정에 한국어 이름·메시지로 만들고, 국가는 시드로 표시 ('Demo data').
- 실제로 만들 것 (원문 6-5): 주문 12건(구매자별 서연 1·지호 1·Yuki 3·Lena 2·buyer_m 5), 상품명이 들어간 캡처 완료 주문, 합의 단계 분쟁 3건(D1 지호 SNAD, D2 서연 INR, D3 buyer_m INR), 추적번호 7건 등록·5건 미등록.
- 만든 주문·분쟁 ID는 `tests/sandbox/manifest.json`에 기록한다 (AC13이 읽는다).

## 10. 개인정보 (검토 M9)
- 구매자가 보낸 개인통관고유부호는 화면에서 마스킹하고, 앱 로그·LLM 프롬프트에 넣지 않으며, 택배사 전달 용도로만 쓴다.
- 통관 안내 문구는 제출 전 관세청 안내로 확인한다.
- 시드 행에는 'Demo data' 배지, 가정값에는 'Assumption' 배지. "보장"·"예측 정확도" 문구 금지.

## 11. 레인과 폴더 소유권
| 레인 | 폴더 (수정 가능) |
|---|---|
| engine | `src/engine/` (기대 손실, 정책·오토파일럿 판정, 확대 위험 점수, 시뮬레이션), `config/params.json`, `config/rules.json` |
| paypal | `src/paypal/`, `src/exec/`, `scripts/sandbox/`, `scripts/create-sandbox-orders.ts`, `scripts/capture-sandbox-orders.ts`, `tests/sandbox/`, `tests/fixtures/` |
| ai | `src/ai/` (분류, 번역, 토큰 검사, 문구 생성), `scripts/eval-classifier.ts` |
| ui | `src/app/`, `config/copy.*.json` |
| data | `seed/` |

- 숫자 계산은 engine에서만. 자기 모듈의 테스트는 `tests/unit/`, `tests/integration/`.
- **컨트롤 타워만 수정:** `SPEC.md`, `DECISIONS.md`, `TASKS.md`, `tasks/`, `src/types.ts`, `tests/acceptance/`, `CLAUDE.md`, `README.md`, `docs/`, `.claude/`. **사람만:** `inbox/`. **작업 세션:** `reports/`에만 보고.

## 12. 설정 파일
| 파일 | 내용 | 소유 |
|---|---|---|
| `config/params.json` | f, t, x, p_acc, 유형별 p_win, 처방 배수, 상품별 기본 분쟁 확률. 값마다 `source` | engine |
| `config/rules.json` | 제안 대상 유형·한도, 오토파일럿 규칙, F1 기준, 확대 위험 가중치, 확신도 기준 | engine |
| `config/copy.en.json`, `config/copy.ko.json` | 화면 문구 (화면은 영어) | ui |

인수 테스트는 라이브 설정을 읽지 않고 `tests/acceptance/*.fixture.json` 고정 사본을 넘긴다.

### 시드 데이터 (`seed/`, v2.2)
- 타입은 `src/types.ts` 8부. 원문 6장 그대로: 상품 4, 구매자 12, 문의 31, 분쟁 9, 주문 214 (샌드박스 12건은 `tasks/T001.md` 배정 표가 정본).
- `SeedDispute.orderId`: 분쟁이 걸린 주문. `SeedOrder.date`: 주문일 `YYYY-MM-DD`, 시연 시점(2026-11-10) 기준 90일 창 안 (v2.2, Q10).
- 종결 분쟁 손실은 결과 종류 + 상품 가격 + f에서 만든다. **수수료는 질 때만**: 전액 환불 = 상품 가격, 패소 = 상품 가격 + f, 승소 = 0. 합 41300¢ ($413. 원문은 f = $8 기준 $408) (v2.2, Q8).
- 국가 분포는 US 95 · KR 53 · JP 31 · DE 31 · GB 4 (원문 4-1 비율을 영국 구매자 4건을 뺀 210건에 적용). 원문 구매자 12명 밖의 주문·문의는 이름 없는 구매자 `X…`로 둔다 (Q10).

## 13. 미확정 (임시값으로 진행, DECISIONS.md에 미확정 표시)
| ID | 질문 | 임시값 |
|---|---|---|
| Q1 | "다시 산다(재구매)"가 핵심 가치인데 기대 손실 식에 재구매가 없음. 의도인지 | 재구매 없음 (M1 식) |
| Q2 | 서연 점수 7 → 4로 바꿀지, 응답 기한을 72시간 밖으로 옮겨 6 → 3을 유지하고 S1 "2 days left"를 바꿀지 | 7 → 4 |
| Q3 | 오토파일럿 가벼운 버전 P0 | P0 |
| Q4 | 시뮬레이션 숫자 | **확정 (v2.2)**: PRD 값을 하드코딩하지 않고 우리 계산 결과 사용 (8장) |
| Q5 | B1·A1·A2·F1 외 세부 유형의 p_win, 가디건 외 상품 3개의 유형별 기본 분쟁 확률 | 컨트롤 타워 임시 가정값 (`source: "가정(임시)"`) |
| Q6 | 샌드박스 비즈니스 계정: 지금 앱은 KR 비즈니스 계정에 묶여 있음. US 비즈니스 계정과 새 앱이 필요 | 사람이 만들고 `.env` 교체 |
| Q7 | 판매자가 이겨도 분쟁 수수료 f가 부과되는지, claim 단계 이후에 환불하면 수수료가 붙는지 (기획자 답 대기) | 질 때만 부과 (5장 식 그대로). 답이 오면 5장 식과 시드 종결 손실에 함께 반영 |
| Q8 | 시드의 종결 분쟁 손실 | **결정 (v2.2)**: f = 1500¢, 수수료는 질 때만 → 합 41300¢ (12장). Q7 답에 따라 다시 볼 수 있음 |
| Q9 | 제안 금액 반올림 | **결정 (v2.2)**: x·A를 센트로 반올림한 뒤 식에 넣음 (5장) |
| Q10 | 시드 해석 (국가 비율, 이름 없는 구매자, 분쟁 → 주문 연결) | **결정 (v2.2)**: 국가 비율·`X…` 구매자는 현행 유지, `SeedDispute.orderId`·`SeedOrder.date` 추가 (12장) |
| Q11 | 같은 분쟁의 두 번째 메시지가 같은 계획 ID·요청 ID로 처리되어 전송되지 않음. 요청 ID가 약 61자 | 보류 (P1). 방향: 계약 변경 없이 요청 ID를 hash(계획 ID + 메시지 해시)의 36자 이하 값으로. 길이 제한에 걸리면 앞당김 (DECISIONS.md) |

변경 이력은 `DECISIONS.md`.
