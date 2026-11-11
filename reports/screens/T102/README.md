# T102 스크린샷 (컨트롤 타워 캡처, 2026-11-12)

빌드: lane/ui 010c45b, `AFTERLOOP_REAL_SEND=0 AFTERLOOP_TRACK_LIVE=0`, headless Chrome 1920×1080 밝은 모드. 서버 실제 POST 0 (Send·추적 모두 Simulated).

- `01-before.png` — 서연 상세, 목록에 Done 묶음 없음
- `02-after-send.png` — 서연 Simulated Send 뒤: 서연 줄이 흐려져(opacity .55) 맨 아래 "Done today · Simulated (1)"로 옮겨짐. 상세는 그대로
- `03-after-tracking.png` — 추적 "Add all 2"(dry run) 뒤: 추적 항목이 "Done today · Simulated (1)"로 옮겨짐

참고: Send 뒤 목록의 다른 항목을 눌러도 화면이 바뀌지 않는 문제가 있다 (T102 전부터 있던 문제 — design-match 녹화 10·11 장면도 서연 화면). → T103
