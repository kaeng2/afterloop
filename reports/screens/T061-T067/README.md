# T060 + T061 + T067 — Today 틀·서연 상세·시안 디자인 (병합 전 확인용)

찍은 대상: `lane/ui` 커밋 `9a42f11` (T058 날짜 줄, T060 공용 틀, T061 서연 상세, T067 시안 디자인 포함. **main에 병합하지 않은 상태**). 배포용 빌드, 실제 샌드박스 분쟁·주문 **조회만** + 실제 AI(초안은 열 때마다 조금씩 다르다). 전송·추적 스위치 꺼짐. **버튼은 누르지 않았다.**

| 파일 | 화면 | 크기 |
|---|---|---|
| `today-seoyeon-1920.png` | Today — 서연 (녹화 기준) | 1920×1080 |
| `today-tracking-1920.png` | Today — 추적 2건 + "Add both to PayPal" | 1920×1080 |
| `today-seoyeon-1440.png` | Today — 서연 | 1440×900 |
| `today-tracking-1440.png` | Today — 추적 | 1440×900 |
| `today-jiho-1920.png` | Today — 지호 (같은 부품으로 자연히 바뀐 모습) | 1920×1080 |
| `today-mike-1440.png` | Today — Mike (한 줄 상태) | 1440×900 |
| `products-1440.png` | Products 최소판 (T062에서 바뀜) | 1440×900 |
| `mockup-today-1920.png` | 시안 첫 화면 (참고) | 1920×1080 |
| `compare-mockup-vs-today-1920.png` | **시안(왼쪽) ↔ 지금(오른쪽) 나란히** | 1920×1080 두 장 |

## 시안 첫 화면과 나란히 비교 (컨트롤 타워 메모)

**시안과 같게 된 것**
- 배치: 위쪽 막대 전체 폭, 왼쪽 목록이 화면 왼쪽 끝·전체 높이(#F1EFEA), 오른쪽 상세 흰 바탕. 가운데 상자 없어짐
- 로고 원형 고리 마크 + 굵은 AfterLoop, 알약 탭(Today (5) / Products), 알약 PayPal activity·판매자 칩
- 목록: 왼쪽 위험 색 점 + 오른쪽 상태 알약 배지, 고른 항목 흰 카드 + 그림자, 묶음 제목(NEEDS YOU / PREVENT / ROUTINE)
- 글꼴 Figtree + Noto Sans KR, 카드 2px 테두리·둥근 모서리
- 대화 말풍선: 한국어 원문 크게 + 영어 작게, 사이에 "Oct 30 · Carrier: Customs hold – recipient customs ID missing"
- **1920×1080 한 프레임에 비교 카드부터 [Send in Korean]까지 스크롤 없이 들어온다** (버튼 아래 끝 약 985px)

**사람 결정대로 시안과 다르게 한 것**
- 강조색: 시안의 파랑(링크·로고) 대신 보라빛 남색 하나. 주 버튼도 시안의 검정 대신 같은 강조색
- 위험 점수: 시안의 큰 "6 · High" 대신 오른쪽 위 작은 배지 "High · Score 6 ▾"
- 주인공: 시안에 없는 비교 카드("PayPal data only · Full refund ~~$74~~ → With carrier data · Reply **$37**", "incl. $2 of your time")
- 한 줄 요약: 시안의 파란 "AI" 상자 대신 회색 카드 + **Code decides** (원인은 코드가 판단 — 정직성)
- 답장: 시안의 좌우 작은 두 칸 + 칩 대신 "Seo-yeon reads (Korean)" 크게 → "You write (English)" 작게, 코칭 "5 coaching tips ▸"·역번역·나머지 검사 접기, 검사 3줄 (1.5차 리뷰 ①)
- 목록: Lena 환불·한국 통관부호 3건·Yuki 문의 없음, 추적은 5건이 아니라 실제 2건, buyer_m*** 대신 Mike Morgan, Autopilot 토글 숨김
- 출처 배지 5종(Demo data / Assumption / AI suggests / Code decides) 유지

**아직 남은 차이·걸리는 것**
- 한 줄 요약 카드가 비교 카드와 높이를 맞추느라 아래가 비어 보인다 (글 한 줄에 큰 회색 상자)
- 1920에서 상세가 약 1645px에서 끝나 오른쪽에 흰 여백이 약 270px 남는다 (읽기 폭 제한)
- 1440×900에서는 [Send in Korean]이 화면 아래로 내려간다 (녹화는 1920 기준이라 영향 없음)
- 머리글 "Wool Sweater, Navy $72.00" — 사람이 적은 꼴은 "Wool Sweater $72"
- 추적 스위치가 일부만 켜졌을 때 결과 줄이 "Simulated"가 아니라 "2 of 2 not added"로 나온다 (POST는 0회. 녹화 땐 세 스위치를 모두 켠다)
- Products는 아직 최소판 (T062)

## 녹화 때 알아 둘 것
- 추적 등록의 녹화 스위치 이름은 코드 기준 **`AFTERLOOP_TRACK_RECORDING`** (`tasks/T063.md`의 `AFTERLOOP_RECORDING`은 틀린 이름 — 지시서 고침)
- 전송 모드 표시: "Simulated send — nothing goes to PayPal" ↔ "Live · PayPal sandbox"
