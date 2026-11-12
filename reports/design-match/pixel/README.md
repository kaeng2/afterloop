# 그림 비교 (사람 결정 2026-11-12 09:25 ③)

- 앱: lane/ui 3e16269 (= main + T107 + T110), `AFTERLOOP_REAL_SEND=0 AFTERLOOP_TRACK_LIVE=0` 빌드
- 시안: `docs/design/mockup-v4/` 세 파일의 **사본에 앱과 같은 데이터를 넣은 것** (저장소 밖 임시, 넣은 값 = `mock-data-NOTES.md`)
- 찍기: headless Chrome, 1440×1000 · 1920×1080 전체 페이지, 애니메이션·전환 끔. 차이 = 채널별 차 > 40인 픽셀, 16px 칸으로 묶은 영역(빨간 상자).
- 앱 전용 예외 요소 중 **세로 자리를 차지하는 띠만** 숨기고 찍었다: /intro `.intro-band`, /listing `.ls-band` (Demo mock 띠 — 22:15 결정). 나머지 예외는 그대로 찍혀 차이로 남는다.

| 화면 | 1440 | 1920 | 처음 (T107 전, 띠 포함) |
|---|---|---|---|
| Desk `/?item=PP-R-GMS-10197661` | **4.71%** | 6.02% | 12.03% / 10.04% |
| /intro (Scene 1) | **0.62%** | 0.43% | 14.66% / 10.99% |
| /listing (Scene 3) | **0.01%** | 0% | 10.11% / 8.28% |

## 남은 차이 = 모두 예외 또는 시안 사본 데이터 사정

**Desk** (`desk-1440-diff.png`)
- 예외 (DECISIONS 11/11 22:55·v2.15):
  - 위쪽 오른쪽 "Public demo · simulated sends"·PayPal activity·EN/한국어·판매자 칩
  - 이번 주 카드 Demo data·Assumption 배지와 4칸 내용 (근거 없는 성과 숫자 금지)
  - 곡선·반응 칸·선택지 Assumption 배지, "Simulated send — nothing goes to PayPal"
  - 분쟁 번호·이름·날짜·금액 (실제·엔진 값. 번호가 길어 한 줄 처리)
  - 머리글 "· Waiting for your reply" (화면 읽기 전용), 카드사 문구 밑줄 (v2.10 ①, 사람 확인 대기)
- 시안 사본 데이터 사정 (`mock-data-NOTES.md`):
  - 이번 주 4번째 칸의 빈 라벨·값 줄 → 왼쪽 칸 아래가 약 20px 아래로
  - 한국어 미리보기 줄바꿈 (사본은 한 문단)
  - 사본에 남은 예전 앱 문구 (앱은 이제 시안 원문: "AI translation below", "{name}'s mood next", "cost ~$N")
  - Offer 카드 57%/$60 줄 (앱은 정책상 없음), 곡선 x축 날짜 (시안도 그리지 않음 — innerText에만)
- 글자 가장자리의 옅은 빨강: 같은 글꼴의 next/font·Google Fonts 렌더링 차이

**/intro**: 로고 자리 "Seller dashboard" (사본 "PayPal Business" — 22:15 결정)로 탭이 옆으로 밀림, EN/한국어 선택, 말풍선 위치 (탭을 따름)

**/listing**: DisputeLess 메뉴 아이콘 몇 픽셀 (25px)
