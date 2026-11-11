# 시안 v4 ↔ 앱 나란히 (1920×1080, 밝은 모드)

- 앱: main 932294f 빌드 (= lane/ui-desk 9e11f58), 로컬 `next start`, **공개 모드** (실제 샌드박스 읽기, AI 캐시, 보내기 Simulated)
- 시안: `docs/design/mockup-v4/` 파일 그대로 + react 18.3.1 UMD (저장소 밖 임시 폴더에서 띄움)
- 도구: playwright-core + 시스템 Chrome, 같은 순서로 눌러 찍음. 파일 이름 `<장면>-mock.png` / `<장면>-app.png`, 녹화 `motion/<화면>-mock.webm` / `-app.webm`
- 2026-11-12 03:50 KST, 컨트롤 타워

## 순서
- Desk: 01 첫 화면 → 02 Show history → 03 환불 카드 → 04 답장 카드(타이핑) → 05 Try a rushed reply → 06 Use AI draft → 07 Details → 08 Send → 09 Forward to carrier(앱만 — 시안은 Auto) → 10 Knit Cardigan(지호) → 11 추적 누락 줄
- Scene 3: s3-01 폼 → 02 Publish(점검) → 03 See details and fix → 04 넣기 → 05 Recalculate → 06 Publish
- Scene 1: s1-01 첫 장면 → 02 DisputeLess 아이콘

## 쓰기 0회 확인
녹화 동안 PayPal activity 서랍: Send는 "Simulated · not sent"(POST 줄은 기록만, 실제 호출 없음), 나머지는 GET 읽기뿐. 서버 로그에 실제 POST 0.

## 남은 차이 (inventory 예외 외에 눈으로 본 것)
1. 앱의 AI 초안에 "Vague timing" 칩(−13 pts)이 하나 뜬다 — 초안의 "as soon as I receive it"을 엔진 정규식이 모호함으로 본다. 시안의 AI 초안은 "5 good"만. (엔진 정규식 문제, 숫자 일치 AC33에는 영향 없음)
2. 시안은 처리한 항목을 "Done today" 묶음으로 옮긴다 — 앱은 예외로 뺌 (사람 결정 대기).
3. 위험 % 큰 숫자 40px (시안 44px), 판매자 점 색(앱은 강조색, 시안은 빨강) — T098b가 의도적으로 남김.
4. Scene 3 점검 결과에 Assumption 배지가 8곳 (시안 0) — "최소한" 규칙에 비해 많다 (사람 결정 대기).
5. 데이터 차이(예외): 사건 번호·이름·날짜·숫자는 실제/엔진 값, 시안의 "Nov 5 promise"·Refund backup·Expected delivery·Yuki·Lena 없음, 수수료 $15.
6. 시안 11번(추적 누락 줄)은 자동 클릭이 못 찾음 — 시안 목록 줄 이름이 달라서. 앱은 찍힘.
