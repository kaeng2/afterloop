# T103 확인 (컨트롤 타워, 2026-11-12)

빌드: lane/ui f27effb, `AFTERLOOP_REAL_SEND=0 AFTERLOOP_TRACK_LIVE=0`, headless Chrome 1920×1080. 페이지 오류 0, 서버 오류 0.

고치기 전: 서연 Send 뒤 지호 링크 → 28초 뒤에도 주소 그대로, RSC 요청 0.
고친 뒤: 서연 Send → 지호 링크 → 바로 이동 (RSC GET 1회) → 추적 → Add all 2(dry run) → 서연으로 돌아오기까지 모두 이동.

- `01-jiho-after-seoyeon-send.png` — 서연 Send 뒤 지호로 이동. "+$37 just now" 유지, 목록 맨 아래 Done today · Simulated (1)
- `02-tracking-added.png` — 추적 등록 뒤 Done today · Simulated (2)
- `03-back-to-seoyeon.png` — 서연으로 돌아옴 (목록의 Done 묶음은 화면 상태라 유지)
