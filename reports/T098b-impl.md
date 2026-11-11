# T098b 보고 (2026-11-12 02:15)

- 기준 SPEC: v2.15 (시작할 때 SPEC.md 첫 줄 `SPEC v2.15`와 같음: 예)
- 브랜치 / 마지막 커밋: lane/ui-desk (지시서의 lane/ui 대신, 사람 지시) / 282f41f (+ 이 보고서 커밋)
- worktree: `afterloop-wt/ui-color`

## 결과
완료 — `reports/design-match/inventory.md` Desk 절 162행 모두 상태·근거 채움 (빈 칸 0, `npx tsx scripts/design/inventory.ts` 다시 돌려도 유지 확인). 넘겨받은 것 ①②③ 구현. Scene1·Scene3 절, `src/app/intro`·`listing`은 건드리지 않음.

- Desk 절 채운 행: 73행 새로 + 8행 덮어씀 (T098b로 내용이 바뀐 행: 토스트 그림자·focus·editor focus·toast rise·later 3000·setTimeout·ghost)
- 상태: 구현함 147 / 예외 15 (모두 DECISIONS 22:55 목록 중 하나를 적음)

## 넘겨받은 것
| # | 내용 | 자리 | 시험 |
|---|---|---|---|
| ① | Send 뒤 단계마다 곡선에 점 하나씩 (시안 liveP: 보낸 답장 점 다음부터 칸의 0.8배 간격, 보낸 뒤 실선 `curve.dash '0'`, ping은 마지막 점, 큰 % = 마지막 값). 값은 엔진 `scenarioRisk`를 `riskTrail`로 순서대로 옮기기만 함. 단계 줄의 `CaseEvent.source='simulated'`는 T092 그대로 | `progress-model.ts riskTrail`, `case-progress.tsx`(setTrail, 떠날 때 비움), `draft-forecast.tsx`(trail), `desk-model.ts curveView(points, draftP, trail)`, `risk-curve.tsx`, `case.css .curve-draft-sent` | `tests/unit/app-t098b.test.ts` ① (4개) |
| ② | 움직임 줄이기여도 토스트 3초 유지. 전에는 `later()`가 0ms로 바꿔 바로 사라졌다. 숨김만 `hideLater`(설정 hideMs 3000 그대로), 애니메이션은 globals.css 규칙이 끈다. Today `savings.tsx` 토스트는 원래 3초 | `case-progress.tsx hideLater` | app-t098b ② |
| ③ | 시안 그림자 목록 그대로: `--shadow-ai`·`-row-on`·`-bubble`·`-work`·`-focus`·`-editor-focus`·`-hairline`·`-ghost`·`-toast` (globals.css). outline·테두리·::before 띠로 바꿔 그리던 자리 되돌림 (editor focus, [Remove], ✓ 칩·tsum, 받은 말풍선·typing, 지금 대응·제안 카드, 고른 목록 줄, 토스트 2곳). 옛 시험 T047 B-3 "그림자 하나만"은 "`--shadow-*` 변수로만 + 변수 값은 시안 파일의 box-shadow 값" 검사로 바꿈 (시안 파일을 읽어 비교 — 지어낸 그림자 금지는 유지) | `globals.css`, 각 css | `app-shared-design.test.ts` B-3 (2개), app-t098b ③ |

## 시안과 달라서 고친 것 (Desk 절 빈 행 대조)
- 색: `.b-tint` #05378214 / hover #05378227 (전 #E3F3FF/#C9E3FF), `.b-black:hover` #333333 (전 없음), `.btn:disabled` opacity .45 (전 회색 바탕), focus #097FF5 + 흰 2px 띠 (전 #0066F5 outline만), 보조 글 #6C7378 `--color-sub` (전 #5a5e66 — 시안에 없는 색. Desk css 3개에서 모두 바꿈, Today 바탕은 시안 `.dk`처럼 흰색으로 해서 대비 4.8:1), `.it:hover` #F5F7FB, `.zone-buyer` #EEF1F5 (전 #EEF0F3), 곡선 면 rgba(196,50,31,.08), 이번 주 칸 rgba(255,255,255,.08), 사건 요약 줄 #F5F9FF + 글자 #0A1B3D (전 그라데이션), 구매자 점 #3F4144 (전 #000), sevCol med #002991·low #9AA0A6 (전 노랑·초록), 머리 알약 바탕 #05378214, ✓ 칩 글자 #0A1B3D
- 그라데이션: `.ai` `120deg #002991 0% / #0066F5 55% / #60CDFF 100%` (전 60%), `.zone-work::before` `90deg` 세 색 고른 간격 (전 60%). 60% 그라데이션은 시안에서 Auto 아이콘에만 쓰여 예외 처리
- 안 쓰게 된 토큰 `--color-accent-tint` 지움 (T067 시험이 "정의만 있고 안 쓰임"을 막음)

## 예외로 둔 것 (15행)
- 로고 안 색 #003087·#0070E0·#00A8EA·#0B0F14 — 지시서 규칙 2 "로고 안 색은 로고 없음 예외"
- Auto 그라데이션(60%) · st.auto 갈래 — Send 이후 "Auto 없음"
- 결과 상자 resOn·resBg·resKey 색·`linear-gradient(120deg,#E3F3FF,#F5F9FF)` — 데이터 (근거 없는 성과 숫자)
- refundNow · s.auto — 안전장치·Send 이후 (T092·T100 그대로)
- `.nav` hover·글자색 — 진입점(탭 없음, T096 그대로)
- `s.done[i.id]` 두 행 (Done today 묶음·흐림·회색 점) — 아래 "결정" 1번

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/globals.css` | 시안 색·그림자 토큰 추가, `--color-zone`·AI 그라데이션 값 시안대로, 포커스 블록, `--color-accent-tint` 삭제 |
| `src/app/today/today.css` | 줄 hover·고른 줄 그림자·이번 주 칸·sev 점·토스트 그림자·추적 버튼 hover/disabled·흰 바탕·보조 글 색 |
| `src/app/cases/view/case.css` | 받은 말풍선·지금 대응 그림자, AI 알약 그림자, 곡선 면·실선·구매자 점, 사건 요약 줄, focus, 보조 글 색 |
| `src/app/cases/reply/reply.css` | editor focus·✓ 칩·tsum·[Remove]·제안 카드 그림자, Send hover/disabled, Details focus, 보조 글 색 |
| `src/app/cases/progress/case-progress.css` / `.tsx` / `progress-model.ts` | ① trail, ② hideLater, 토스트·typing·AI 알약 그림자, Forward focus 띠 |
| `src/app/cases/desk-model.ts` / `view/risk-curve.tsx` / `view/draft-forecast.tsx` | ① 곡선 단계 점 |
| `src/app/_shared/shell.css` | `.desk-button-tint`·`.shell-for` 시안 tint |
| `tests/unit/app-t098b.test.ts` (새) | ①②③ 8개 |
| `tests/unit/app-shared-design.test.ts` | B-3 그림자 규칙 → 시안 그림자 목록 검사 + 시안 자리 검사 |
| `tests/unit/app-t067.test.ts`·`app-t090.test.ts`·`app-today.test.ts` | 옛 대체 모양(::before 띠, 60% 그라데이션, 말풍선 1px 테두리, 그림자 하나)을 시안 값 기대로 |
| `reports/design-match/inventory.md` | Desk 절만 |

무변경 확인: `src/app/_server/send.ts`·`mode.ts`·`activity.ts`, `src/engine/`, `config/`(숫자·문구), `src/app/intro/**`·`listing/**`, inventory Scene1·Scene3 절. 실제 AI·PayPal 호출 0, 개발 서버 안 띄움, `.env` 안 읽음. 시안은 코드로 대조함 (브라우저 렌더 없이 — 아래 남은 문제 3).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | |
| npm test | 2455 | 0 | 첫 전체 실행에서 `storefront.test.ts` "결정론 100회"가 5초 시간 초과 1회 (내가 안 건드린 파일, 따로·다시 돌리면 통과) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |
| npx tsx scripts/design/inventory.ts | Desk 빈 칸 0 유지 | | "변경 없음 (같은 시안)" |

## 남은 문제
1. 옛 시험 4개(T047 B-3·T060·T067·T090)의 기대값을 시안 값으로 바꿨다 — 22:55 결정("기준은 시안 파일 자체")과 지시서 ③ 근거. 인수 테스트(`tests/acceptance/`)는 안 건드림.
2. 시안 표에 없는 앱 전용 색은 남겼다: 사건 기록·곡선의 판매자 점(`seller` = 강조색, 시안은 판매자 실수를 'bad' 빨강으로 그림 — 데이터 분류라 바꾸지 않음), 위험 % 큰 숫자 40px(시안 44px, 글자 크기 단계 규칙).
3. 나란히 스크린샷·녹화는 컨트롤 타워 몫 (지시서). 특히 볼 곳: Today 왼쪽 칸 흰 바탕, 포커스 흰 띠, 지금 대응 카드 그림자, Send 뒤 곡선 점 4개.

## 컨트롤 타워에 요청할 결정
1. **Done today (`s.done` 두 행)**: 시안은 처리한 항목을 화면 상태로 "Done today" 묶음에 옮기고 흐리게·회색 점으로 그린다. 앱 목록은 실제 분쟁 상태를 읽고 공개 모드 Send는 Simulated라서, 22:55 "데이터: 실제 시드·샌드박스 사건만"을 근거로 **예외**로 적었다. 화면 상태로라도 Done 표시를 원하면 지시서로 알려 달라 (Today 목록이 서버 컴포넌트라 클라이언트 상태 연결이 필요).

## main 병합 (T098a·T100)
- main을 lane/ui-desk에 병합. 충돌은 `tests/unit/app-shared-design.test.ts` 한 파일뿐이었고 두 쪽 뜻을 모두 살려 풀었다.
- 합친 그림자 규칙: `intro/`·`listing/` css는 `var(--shadow-*)` 또는 자기 화면 변수(`--i-shadow-*`, `--ls-shadow-*`) 또는 `none`, 그 밖 css는 `var(--shadow-*)`만. `var(--shadow-*)`는 모두 light 변수에 정의돼 있어야 한다.
- 두 쪽의 새 시험 블록('T098b: 시안 그림자 자리마다', 'T098a 시안 그림자')은 모두 남겼다. 다른 파일은 바꾸지 않았다.
- 확인: `npx tsc --noEmit` 0, `npm run lint` 0, `npm run test:acceptance` 177 통과(9 skip), `npm run build` 성공, `npm test` 2472/2473 — 실패 1건은 `storefront.test.ts` '같은 입력 100회'가 병렬 실행 중 5초 시간 초과(단독 재실행은 31/31 통과). 첫 실행에서 한 건이 더 실패했으나 이후 3회 재실행에서는 재현되지 않았다(내용 미확인 — 병렬 부하 시간 초과로 추정).
