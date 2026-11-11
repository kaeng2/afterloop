# main e56c223 (T062·T065·T070·T072 + AI 캐시) — 공개 모드 스크린샷

배포용 빌드, `DEMO_MODE` 없음 = **public** (`/api/health` → `{"ok":true,"mode":"public"}`), 실제 샌드박스 조회 + AI 캐시. 버튼 중 누른 것은 Products "Turn all on"뿐 (브라우저 계산, PayPal 호출 없음). 헤드리스 크롬이 어두운 모드로 찍혔다.

| 파일 | 화면 |
|---|---|
| `today-seoyeon-1920.png` | Today — 서연 (위에 "Public demo · simulated sends", 칩 Follow-up: Nov 18, Send 옆 "Simulated send") |
| `products-1920-off.png` | Products 처음 상태 (처방 모두 꺼짐, $216, 빨간 점 4, could save $46·$66·$19·$79, 통관 "Simulated" 점선, 거래 11건) |
| `today-tracking-1920.png` | Today — 추적 2건 |
| `products-all-on-pane.jpg` | 브라우저 창에서 "Turn all on" 뒤 ($216 → $44, 표 셀 4개 깜빡임 확인) — 창 축소본 |

본 것: 토글·깜빡임 정상(깜빡인 셀 4개), 가로 넘침 없음. **문제: 왼쪽 AG Grid 표가 288px로 좁아 "Left" 열·값이 잘림("$137 → $1…")** → T073. "Public demo" 줄이 왼쪽 끝에 여백 없이 붙음 → T073.
