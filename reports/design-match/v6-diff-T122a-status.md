# v6-diff.md "구현 상태" — T122a 범위 (lane/ui)

`reports/design-match/v6-diff.md`(main)의 "구현 상태" 칸에 옮길 값. 이 브랜치에서는 그 파일을 직접 고치지 않았다
(main에만 있는 파일이라 레인에서 새로 만들면 병합 때 add/add 충돌. T122b·T122c도 같은 표의 옆 줄을 채운다).
판정은 T123 자동 비교 도구 결과만 근거다 (20:45 결정) — 아래는 구현자 상태일 뿐이다.

표기: **구현** = 이 브랜치에 들어감 (T123 판정 대기) · **변경 없음** = v4와 같아 할 일 없음(확인) · **범위 밖(T122b/T122c)** · **미처리(요청)** = 수정 가능 폴더 밖이라 컨트롤 타워 결정 필요.

| id | 구현 상태 |
|---|---|
| V6-A1 | 구현 — `desk.css` `.dk .tg`·`.dk .tg:hover` (시안 L49 그대로) |
| V6-A2 | 구현 — `.dk .tg-tr` (transition background .2s ease) |
| V6-A3 | 구현 — `.dk .tg-kn` (transition left .2s ease) |
| V6-A4 | 구현 — `.dk .tg.on .tg-tr` #0070E0 · `.tg.on .tg-kn` left 21px. 색은 시안 값 그대로 (치환 안 함 — 09:25 "시안 CSS 통째 복사" 규칙) |
| V6-A5~A14 | 범위 밖(T122b/T122c) |
| V6-A15 | 변경 없음 (이 영역 규칙 `.zone-work`·`.stp`·`.tray`·`.editor` 등 그대로) |
| V6-B4 | 범위 밖(T122b) — 처음 상품 칩 `sku:'sweater'`는 `(app)/page.tsx`·`today/**`(T122b 파일). 지시서 1번에 있으나 수정 가능 폴더 밖 |
| V6-B29 | 구현 — 머리글 분류 칩 늘 회색 (`case-view.tsx` `desk-chip`, `desk-chip-bad` 분기 삭제) |
| V6-B30 | 구현 — 말풍선 보조줄 `<b class="case-bubble-tr">Translated</b> · …` (#0070E0 700) |
| V6-B31 | 구현 — 위험 상자 오른쪽 칸 200px, "Dispute risk" / 무응답 %(취소선) → 지금 %(30px/900) / "{mood next} · {mood 12px}". `rFrom` = 엔진 무응답 예측(빈 글 + noReplyDays, 시안 고정 89% 대신). **색 기준은 기존 0.5(`riskTone`)** — 시안 0.45 기준은 config에 값이 없다 → 미처리(요청) |
| V6-B32 | 구현 — 번역 칸을 editor 안쪽 아래로(`reply-box-in`: #F6F7F9 · 위 테두리 · 10/14/12), tray는 오른쪽 칸 + 테두리 1px #E4E6E9 · radius 18 · stretch |
| V6-B33 | 구현 — `reply-pair` 늘 2열 · align-items start (기존 규칙 유지, 좁은 폭은 1열) |
| V6-B34 | 변경 없음 (선택지 카드·단계 레일·점검 줄·예상 반응 막대·곡선·시간선·보낸 뒤 결과 그대로. Send 이후 예외 유지) |
| V6-B35 | 구현 — `showSimple`/`showAi` 두 갈래 (`DeskSelection.aiOn`, 같은 section·같은 자리 children) |
| V6-B36 | 구현 — `AiSwitch` (`button.tg` role=switch aria-checked + AI 알약 + "Respond now" + 트랙·손잡이), 꺼짐·켜짐 머리 같은 자리 |
| V6-B37 | 구현 — 꺼짐 카드(`work-simple`) "Your reply" + 스위치, textarea rows 4 "Write a reply…", 힌트 + [Send]. 안전장치: 쓴 글은 [Translate & check] 뒤에만 Send, 전송 모드 글자(Simulated) 유지, 서버 관문 그대로 |
| V6-B38 | 구현 — 켜짐 머리 "Your reply" + 부제 + 오른쪽 스위치. aria-label "Respond now"(workT) |
| V6-B39 | 구현 — 단계 2 라벨 "Write and check" (`case.reply.writeTitle`) |
| V6-B40 | 구현 — Send 라벨 "Send"/"보내기" (`case.send.button`) |
| V6-B41 | 구현 — 번역 칸 제목 "Translation (Korean)" (`case.reply.translationTitle`, 언어 = 구매자 언어 데이터) |
| V6-B42 | 구현 — tray 테두리·radius (B32와 같은 규칙) |
| V6-B43 | 구현 — 보낸 말풍선 "Sent · translated"/"보냄". 고친 글도 같은 글 ("auto" 표기는 Send 이후 예외 "Auto 없음"으로 뺌). 단계·결과·타임라인 그대로 |
| V6-B44 | 변경 없음 — 보낸·Simulated 말풍선에는 "Translated" 접두가 원래 없다 |
| V6-B45~B52 | 범위 밖(T122c) |
| V6-C7 | 구현 — "Sent · translated" |
| V6-C8 | 구현 — "Sent · translated" (시안 "Sent · auto-translated"의 "auto"는 예외로 뺌 — 결정 필요하면 알려 주세요) |
| V6-C9 | 구현 — "Translation (Korean)" |
| V6-C10 | 구현 — "번역 (한국어)" (`번역 ({{language}})`) |
| V6-C11 | 구현 — "Send" |
| V6-C12 | 구현 (ko send "보내기") · 지호·kc 부분은 범위 밖(T122c) |
| V6-C13 | 구현 — `case.reply.phSimple` "Write a reply…" |
| V6-C14 | 구현 — "답변하기…" |
| V6-C15 | 구현 — `case.reply.simpleHint` |
| V6-C16 | 구현 — ko simpleHint |
| V6-C17 | 구현 — workT는 스위치 라벨로 이동 (`case.work.title`) |
| V6-C18 | 구현 — replyT는 카드 제목으로 이동 |
| V6-C19 | 구현 — "Write and check" |
| V6-C20 | 구현 — "쓰고 점검하기" |
| V6-C46 | 구현 — 말풍선 "Translated" 별도 굵은 파랑 (B30) |
| V6-C48 | 변경 없음 — riskNow "if no reply by {date}"는 T105 그대로 (빈 답장에서 곡선 아래). riskT "Dispute risk"는 `case.reaction.riskTitle` 신규 키 |
| 그 밖의 C (C1~C6, C21~C45, C47) | 범위 밖(T122b/T122c) |
| V6-D* | 범위 밖(T122b/T122c) — D9·D10 변경 없음 |
| V6-E1 | 구현 — `aiOn` 처음 꺼짐 (`DeskSelectionProvider initialAiOn=false`) |
| V6-E2 | 변경 없음 — goods 접기는 기존 Details 펼침 그대로 |
| V6-E4 | 구현 (draft `''` · path `custom`) · sku는 범위 밖(T122b) |
| V6-E6 | **미처리(요청)** — 타이핑 32ms/1글자는 `config/motion.json` `desk.typeOut`(지금 34/2) 값. 수정 가능 폴더 밖. 코드는 config 값을 그대로 읽는다 → 값만 바꾸면 반영 |
| V6-E7 | 구현 — 켜면서 빈 글이면 AI 초안 타이핑, 쓴 글은 그대로. **끄면 빈 답장**(결정 20:40 2번을 따름 — 시안 코드는 글을 남김) (`aiToggleStep`) |
| V6-E8 | 구현 — 꺼짐 Send = 바쁨·빈 글·초안 없음·관문(`editGate`) 하나라도면 꺼짐. 켜짐 `sendOff` 그대로 |
| V6-E9 | 구현 |
| V6-E16 | 구현 — `rFrom` = 엔진 무응답 값, `rTo` = 지금 글 예측(빈 글이면 같은 값), moodSt 12px · line-height 삭제 |
| V6-E17 | 미처리(요청) — E6과 같음. 나머지 타이머 변경 없음 |
| V6-E18 | 변경 없음 — `send()`·관문·서버 액션 그대로 |
| V6-E19 | 변경 없음 — rushed·Use AI draft·Clear·onType 그대로 |
| V6-E3, E5, E10~E15 | 범위 밖(T122b/T122c) |
| V6-F1 | 구현 |
| V6-F2 | 구현 |
| V6-F3 | 구현 (스위치를 켤 때만 타이핑) · 속도 값은 미처리(요청, E6) |
| V6-F4 | 변경 없음 |
| V6-F5 | 구현 (`.tg:hover`) · `.ag-*` hover는 범위 밖(T122b) |
| V6-F6 | 구현 — `.reaction-risk-to` transition color .3s |
| V6-F7 | 범위 밖(T122b) |
