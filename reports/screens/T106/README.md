# T106 확인 (컨트롤 타워, 2026-11-12)
빌드 lane/ui-desk f3d1c1f (T104+T105+T106), `AFTERLOOP_REAL_SEND=0 AFTERLOOP_TRACK_LIVE=0`, headless Chrome 1440×1000 + 390 폭. 페이지 오류 0, 서버 오류 0.
첫 요청(서버 막 켠 뒤) 3.26초, 다음 요청 0.08초. 항목·칩 클릭 때 RSC·서버 요청 0 (주소만 replaceState로 바뀜). 새로고침하면 같은 항목.
- `01-jiho.png` — 지호 zone-work 카드 "Offer 15% back ($7.20), the buyer keeps it" + [Send offer] + Simulated
- `02-chip-keeps-jiho.png` — Cashmere Coat 칩을 눌러도 지호 상세 유지 (`?item=…&sku=…`)
- `03-offer-sent.png` — "Offer sent ✓" 꺼짐, 토스트 "+$30 kept"
- `04-tracking-added.png` — "Added ✓" 꺼짐, 토스트 "+$1 kept"
- `05-all-done.png` — 서연 Send(끝에 토스트 1번 "+$37") 뒤: Done today · Simulated (3), 칩 배지 사라짐, "1 open cases"
- `06-mobile-jiho.png` — 390 폭 지호
