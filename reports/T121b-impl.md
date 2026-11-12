# T121b 구현 보고 (data 레인, 기준 SPEC v2.16) — **부분 완료, 막힘**

## 한 일
- `seed/demo-display.ts`·`seed/demo-display.json`: #1038 `paypalRef` = `PP-R-ZOK-10200237`.
- `tests/unit/seed-demo-display.test.ts`: 그 기대값 갱신.

## 막힌 것 (컨트롤 타워 조치 필요)
1. **`config/demo-links.json` 편집이 권한 설정으로 거부됨** ("denied by permission settings"). 지시서는 수정 가능이라 했지만 `.claude/settings.json` 잠금이 막는다. 우회하지 않았다. 그래서 연결 표는 **아직 MBJ 그대로**이고, 단위 테스트 `seed-demo-display`의 "paypalRef가 연결 표와 일치" 1건이 실패 상태다 (표를 고치면 풀린다).
   - 넣으려던 내용: ZOK-10200237 → seedDisputeId D1, carrierOrderId O02, showOnScreen true, liveSendAllowed true(기존 지호 줄 승계 — 확인 필요), note에 "PayPal 기한 없음, 기한·5주·30일은 시드 Demo data, 원인 B3"; MBJ-10197650 → seedDisputeId null, carrierOrderId null, showOnScreen false, liveSendAllowed false (HEY와 같은 숨김).
2. **AC29(잠금)와 충돌 예상** — 표를 고쳐도 깨진다. 기대값 변경은 컨트롤 타워 몫:
   - `tests/sandbox/manifest.json`에 ZOK-10200237이 없다 ("표의 분쟁 = manifest의 분쟁" 위반).
   - "지호 D1: 화면 O·전송 O"가 manifest의 D1 = MBJ를 찾는다. MBJ는 숨겨야 하므로 실패.
   - "화면에 보이는 것 = D1·D2·D3" 키 검사도 ZOK의 키가 manifest에 있어야 통과.
   - 시드 분쟁 하나에 줄 하나 규칙 때문에 D1은 ZOK에만 걸 수 있다.
   → manifest D1의 disputeId를 ZOK로 바꾸고 MBJ를 `demoExcluded`로 옮기는 등의 결정 필요.
3. 연결 표 스키마(`DemoLink`)에 기한·원인 필드가 없다. 기한(Nov 19)·원인 B3는 note에만 적는다. 시드 `disputes.json` D1의 subtype은 B1 그대로 (AC17 잠금, 변경 안 함) — B3 기본값은 컨트롤 타워 결정.

## 컨트롤 타워에 요청할 결정
- `config/demo-links.json` 편집 권한 열기 또는 직접 수정, manifest·AC29 갱신, D1 subtype B1→B3 여부, ZOK liveSendAllowed 값.

## 검증
- ac17 통과, ac29 통과(현 표 기준), seed-demo-display 1건 실패(위 1번). 실제 PayPal·AI 호출·.env 읽기 없음.
