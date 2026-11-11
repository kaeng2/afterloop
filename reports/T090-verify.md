# T090 검증 (독립 검증자, 2026-11-12) — 판정: 통과

대상: `lane/ui` `ad9fd7b` (구현 `0627704` + main 병합), 기준 `8e3f7db`. 검증 사본 `afterloop-wt/verify-tmp3`(detached). 저장소 코드 수정·커밋 없음.
(준비 메모: 미추적 `reports/T094-verify.md`가 체크아웃을 막아 스크래치로 옮겼다. ad9fd7b에 내용이 같은 추적 파일이 있어 따로 복원할 것은 없다.)

## 1~9 결과
1. 안전장치 — 통과. `app-t090` "완료 기준 1"(가짜 새 약속 실패 → Send disabled, Details `aria-expanded=true`, 실패한 줄 보임) 통과. `detailsMustOpen`은 보기 쪽만 바꾸고 `canSend`는 그대로. `git diff 8e3f7db ad9fd7b -- src/app/_server/send.ts mode.ts activity.ts` = 0. 공개 모드 쓰기 0회(app-send, ops-t070-gates) 통과.
2. 숫자 — 통과. `app-t090` 완료 기준 3 + `app-t079` 통과. 숫자 계산을 새로 하는 화면 코드 없음(motion.ts는 값 옮기기만).
3. 배지 — 통과. `codeDecides`→null, `aiSuggests`→"AI" 알약. src에 "Code decides/AI suggests" 문자열은 주석뿐. Assumption·Demo data·AI 알약은 남아 있음.
4. 지시서 1~11·모션 — 대체로 일치. 시안 대조: `.btn`·`.it` background-color .15s, `.npath` border/background .15s, 곡선 polyline `all .3s ease`, `.ping` 1.4s ease-out infinite(r 7→20, opacity .6→0), 반응 막대 width .35s ease, `.editor` border-color .3s ease, 알약 background-color .3s 모두 motion.json·css 변수와 같다. reduced-motion: 변수 0s(!important) + 전환 0s + animation none.
   빠진 것 / 주의(모두 보고서에 이미 적힘, 이 태스크 밖):
   - 입력칸 테두리·알약 색을 위험 50% 이상이면 빨강으로 바꾸는 동작(editorSt/pillSt) 없음 — T091 몫(전환 시간만 붙음).
   - 위쪽 막대에 탭(Today·Black Friday rehearsal·Products)이 아직 오른쪽에 있다 — T090 지시서대로. DECISIONS 22:45는 탭 제거 → T096 몫이므로 결함 아님.
   - 안 쓰는 css 규칙 잔존(`.work-ai`, `.case-carrier-line` 등) — 동작 영향 없음.
   - 스크린샷 미확인(서버 금지) — 나도 못 봄. T098 Playwright 비교 몫.
   - 지시서가 "수정 가능 폴더"에 `config/motion.json`을 적지 않았으나 본문 지시대로 생성 — 범위 문제 아님.
5. motion.json — 통과. `desk`(hover·choiceCard·curve·ping·reactionBar·editorBorder)와 `scene3`(check·recalc) 둘 다 있음. Desk는 `src/app/_shared/motion.ts`(zod 검사, `.passthrough()`로 scene3 보존) → `layout.tsx` `<html style>` → css 변수. Scene 3은 `src/app/listing/progress.ts`가 `motion.scene3`를 읽는다. css에 .15s/.35s/1.4s 직접 쓴 곳 없음(listing.css:647의 `0.15s`는 T090 이전 /listing 쪽 hover, Desk 아님 — 사소한 참고).
6. copy — en/ko 키 546 = 546, 차이 0. `.next/static`에서 `AFTERLOOP_|DEMO_MODE|LLM_API_KEY|client_credentials|api-m.sandbox` 일치 0건(빌드 직후).
7. 명령 — `npm run build` 통과(0), `npx tsc --noEmit` 통과, `npm run lint` 통과, `npm run test:acceptance` 177 통과·9 skip·0 실패, `npm test` 2371 통과·1 실패(`storefront.test.ts` 결정론 100회, 전체 실행 시 5초 시간 초과) → 단독 재실행 31/31 통과(보고서와 같음, 엔진 레인 기존 문제).
8. 범위 — `git diff 8e3f7db 0627704 --stat` 30개 파일: config/copy.en·ko, config/motion.json, src/app/**, tests/unit/**뿐. `_server`·엔진·tests/acceptance 0. 허용 밖 파일 없음. (reports는 후속 커밋)
9. 참고 의견 — 제목 "She'll see (Korean)" (`case.reply.sheSees`, 구매자 이름을 알 때) / 이름을 모르면 "The buyer will see (…)":
   - 서연(B01, KO): "She'll see (Korean)" — 적합.
   - 지호(B02 박지호, KO): "She'll see (Korean)" — 이름으로 보아 남성일 수 있어 대명사가 틀릴 위험. 데이터에 성별 없음. (제안 카드의 접힘 요약 `FoldSummary`도 같은 라벨)
   - Mike(B04 EN): Routine 항목이라 답장 칸이 없어 제목 자체가 안 나온다. 만약 영어 구매자 사건에 나온다면 "She'll see (English)" — 번역이 필요 없는 영어인데도 제목이 뜨는 점이 어색.
   - Yuki(JA): "She'll see (Japanese)". 한국어 모드는 "구매자에게 보이는 글 (…)"로 대명사 없음.
   권고: 시안 문구를 그대로 쓸지는 컨트롤 타워 결정. 성별 오류가 신경 쓰이면 "{이름} will see (…)" 또는 대명사 없는 문구로 키 하나(`case.reply.sheSees`)만 바꾸면 된다. 이전 T068 시험의 "대명사 없음" 단언은 T090이 바꿨음.

## 문제
- 결함 없음. 위 4번의 "빠진 것"은 모두 다른 태스크(T091·T096·T098) 몫.
