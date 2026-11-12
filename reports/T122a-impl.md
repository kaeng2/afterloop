# T122a 보고 (2026-11-12 20:50)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄 `SPEC v2.16 (2026-11-12 20:40 KST)`과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서 커밋 — `git log -1 lane/ui`)

## 결과
대부분 완료. 시안 v6 기준으로 세 가지가 들어갔다. (1) 사건을 열면 답장 칸이 비어 있고 무응답 예측이 보인다. (2) "✦ AI Respond now" 스위치: 켜면 선택지 → AI 초안 타이핑 → 점검 → 예상 반응이 펼쳐지고, 끄면 빈 답장으로 돌아간다. (3) 답장 칸 문구 "Write and check" · "Send" · 힌트 · "Translation (Korean)". 미처리 2건은 수정 가능 폴더 밖이라 요청으로 남겼다: 타이핑 속도 config, 처음 상품 칩(T122b 파일).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/view/desk-selection.tsx` | `aiOn`·`toggleAi`·`aiRef` 추가 (공급자 처음 꺼짐 = 시안 v6 L773). 공급자가 없는 칸(시험 등)은 스위치를 바꿀 수 없으니 켜짐(AI 칸 전체). 렌더 중 setState 없음 (T103) |
| `src/app/cases/view/work-zone.tsx` | `AiSwitch` (`button.tg` role=switch). 머리 = "Your reply" + (켜짐) 부제 + 스위치. 꺼짐 `work work-simple` / 켜짐 `work zone-work`. section 하나, 선택지 자리 `{aiOn ? ai : null}` 다음 children 같은 자리 (T118) |
| `src/app/cases/view/case-view.tsx` | 선택지 카드를 `ai` 자리로 넘김. 머리글 분류 칩 늘 회색 (B29) |
| `src/app/cases/view/conversation.tsx` | 말풍선 "Translated" 굵은 파랑 `<b class="case-bubble-tr">` (B30) |
| `src/app/cases/case-detail.tsx` | `DeskSelectionProvider initialPath="custom"` (시안 처음 path) |
| `src/app/cases/reply/reply-panel.tsx` | 처음 글 `''`. 스위치 처리 `onAi` (`aiToggleStep`: 켜면서 빈 글이면 AI 초안 typeOut, 끄면 타이핑 멈춤 + 글·검사 결과 비움 + path custom). **꺼짐 카드**: textarea rows 4 "Write a reply…" + 힌트 + [Send], 쓴 글은 [Translate & check] → 번역 칸 → Send (관문 `editGate`·서버 액션 그대로, 전송 모드 글자 유지). **켜짐**: 단계 2 "Write and check", 번역 칸을 editor 안쪽 아래로, tray는 오른쪽 칸. 위험 상자 오른쪽 칸 = "Dispute risk" 무응답 %(엔진 무응답 예측, 취소선) → 지금 % + "mood next · mood" (B31). Send 라벨 "Send" |
| `src/app/cases/desk-actions.ts` | `aiToggleStep(on, text, anchor)` 순수 함수 (시험용) |
| `src/app/cases/progress/case-progress.tsx` | 보낸 말풍선 문구 키 자리표시자 제거 ("Sent · translated") |
| `src/app/(app)/desk.css` | Respond now 절에 시안 v6 L49 `.tg*` 규칙 그대로, 꺼짐 카드·textarea·힌트(L324–L327), 머리(L325·L332), 번역 칸(L366), tray 테두리(L368), 위험 상자 200px·전→후 글자(L392–L393·L1059), moodSt 12px, `.case-bubble-tr`. 다른 절은 건드리지 않음 |
| `config/copy.en.json`·`copy.ko.json` | `case.send.button` "Send"/"보내기", 신규 `case.reply.writeTitle`·`translationTitle`·`phSimple`·`simpleHint`·`case.reaction.riskTitle`, `case.progress.sentBubble`·`sentAutoBubble` "Sent · translated"/"보냄" (모두 시안 DI.en/DI.ko 값) |
| `tests/unit/app-t122a.test.ts` | 신규 16개 (처음 상태·무응답 예측 입력, 스위치 마크업·두 상태·toggle 단계·같은 자리, 문구 = 시안 값, 번역 칸 위치, 안전장치, 위험 상자 = 엔진 값, CSS = 시안 값) |
| `tests/unit/app-case-reply·t061·t068·t076·t090·t091·t105·t107·t116·t118.test.ts` | 시안 v6 문구·배치로 기대값 갱신 ("Send in Korean"→"Send", "She'll see"→"Translation (Korean)", 번역 칸 위치, 무응답 예측 두 번째 호출, 스위치 머리 구조). 안전장치 단언은 그대로 |
| `reports/design-match/v6-diff-T122a-status.md` | v6-diff.md "구현 상태" 칸에 옮길 값 (아래 "남은 문제" 1) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 179 | 3 | 3개 모두 `ac35.repair-offer` — 엔진에 `repair` 수가 아직 없음 ("repair 평가가 없음"). SPEC v2.16 새 계약(엔진 레인 몫). 이 작업과 무관하고 기준 커밋에서도 같은 실패 |
| npm test | 2623 | 1 | `storefront.test.ts` "같은 입력 100회" — 전체 병렬 실행에서만 시간 초과, 혼자 돌리면 31/31 통과 (이 작업 파일 아님). `sim.test.ts` 50ms 성능 시험도 한 번 부하로 실패했다가 혼자 통과 |
| npx tsc --noEmit | 0 오류 | | |
| npm run lint | 0 오류 | | 경고 2 (`app-t098a-scenes.test.ts`, 기존) |
| npm run build | 성공 | | |

실제 AI·PayPal 호출 0, 개발 서버 실행 없음, `.env` 읽지 않음.

## 남은 문제
1. **v6-diff.md 직접 기입 못 함**: 그 파일은 main에만 있고, 레인 worktree에서 `git checkout main -- …`은 권한 승인이 필요했다. 같은 파일을 새로 쓰면 병합 때 add/add 충돌이 난다. 그래서 행별 상태를 `reports/design-match/v6-diff-T122a-status.md`에 적었다 → 컨트롤 타워가 옮겨 주세요.
2. **타이핑 속도 (V6-E6·E17·F3)**: 시안 v6 32ms/1글자, 지금 `config/motion.json` `desk.typeOut` = 34ms/2글자. 코드는 config를 그대로 읽는다. `config/motion.json`은 수정 가능 폴더 밖이라 바꾸지 않았다.
3. **처음 상품 칩 (V6-B4, 지시서 범위 1)**: 시안 `sku:'sweater'`. 상태는 `(app)/page.tsx`·`today/**`에 있다 (T122b 파일, 수정 가능 폴더 밖) → T122b가 처리하거나 따로 배분해야 한다.
4. **위험 상자 "지금 %" 색 기준**: 시안은 45% 이상이면 빨강. 지금은 기존 `riskTone`(config `riskColor.highFrom` 0.5)을 쓴다. 0.45 기준을 넣을 config 키가 없다. T122b의 위험 단계(riskLvl 45/20, D3)와 같은 값이니 그 키가 생기면 바꾸면 된다.
5. **"Sent · auto-translated" (V6-C8)**: Send 이후 예외("Auto 없음")를 따라 "auto"를 뺐다. 고친 글도 "Sent · translated".
6. **끄면 빈 답장 (V6-E7)**: 시안 코드는 스위치를 꺼도 글을 남긴다. 결정 20:40 2번 "끄면 빈 답장 상태로"를 따라 비웠다.
7. UI 병합 전 스크린샷 확인은 사람 몫 (개발 서버 금지라 직접 보지 못했다).

## 컨트롤 타워에 요청할 결정
- `config/motion.json` `desk.typeOut`을 `{ "intervalMs": 32, "step": 1 }`로 바꿀지 (시안 v6 L801·L804). 바꾸면 코드 수정은 필요 없다.
- 위험 "높음" 기준 0.45를 config에 둘 자리 (riskLvl, T122b와 공용).
- V6-B4 처음 상품 칩을 어느 세션이 맡을지.
- C8 "auto" 표기와 E7 "끄면 비움" 해석이 맞는지 (위 5·6).
