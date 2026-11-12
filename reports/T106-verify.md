# T106 검증 (f3d1c1f, lane/ui-desk + main 병합)

판정: **통과** (결함 없음, 주의 2건)

## 근거
1. 화면 안 고르기: 통과. selection.tsx/product-filter.tsx/today-groups.tsx에 Link·router·fetch 없음. 항목 `<button>`, 칩 `<button aria-pressed>`. 주소는 `history.replaceState`(`?item`/`?sku`, `lang` 보존). `setSku`는 itemId 유지. page.tsx가 모든 항목 상세를 `DetailPane`(hidden)으로 그림, 고른 분쟁은 바로, 나머지는 Suspense. 숨김 처리라 서연 답장 칸 상태 유지.
   - 비용(정직하게): 요청마다 고르지 않은 분쟁의 `CaseDetail`도 실행한다. Mike = `loadCase(draft:false)`로 LLM 0회. 지호/서연(고르지 않은 쪽) = `loadCase`(AI 초안 + 사건기록 요약) + `loadReply`(번역) → 분쟁당 LLM 약 3~4회 후보. 완화: `getLlm()`은 `data/ai-cache/llm-cache.json`(17건) 캐시 + 프로세스 메모리 기억(프롬프트가 토큰이라 키 안정). public은 캐시 적중이면 호출 0, 미적중이면 시간당 20회 한도 소모. recording은 한도 없음 → 캐시 미적중 상태의 첫 요청에서 호출이 늘어난다. PayPal 읽기는 요청 내 `loadDemoDisputesForRequest` 공유 + 90초 읽기 캐시라 추가 왕복 없음. 엔진 예측(곡선·선택지)은 CPU만. 속도 수치는 측정 안 함(브라우저 담당).
2. zone-work: 통과. 시안 L47-48 값과 CSS 일치(r24, 22/22/20, gap18, `--shadow-work`=시안 그림자, `::before` 4px `--gradient-ai-line`, 1px #E4E6E9). 제목 1.25em, 설명 .9375em #3F4144, 머리 h2 1.5em/900/-0.4px(시안 h1; h1 중복 회피로 h2 — 보고서에 명시). 지호: `OfferWork` → `buildReplyView`+`canSendOffer` → `sendReplyAction({kind:'offer',replyId,confirmedCommitments})`, live면 `window.confirm`, 성공 뒤 "Offer sent ✓" disabled, 모드 글(Simulated) 유지. 금액은 `toDollarsCents(plan.amountCents)` 하나(제목·확인창), 버튼엔 금액 없음. "Escalation risk · Score" 줄 없음(grep). 추적: 카드 + `<details>` 주문 표(데이터 유지). Mike/Prevent도 같은 틀.
3. F1-59: `finished=countsAsDone(kind)`(added/simulated)이면 disabled + "Added ✓", 실패/일부 실패는 재활성. F1-63: `report(null)`도 토스트("Dashboard updated"), 칸 깜빡임은 금액 있을 때만. T104 병합: 서연 흐름은 `completeAction`이 마지막 단계에서 한 번만 `report` 호출(reply-panel.tsx:749-760, :947). T106은 호출자를 추가하지 않았으므로 토스트 1개. 참고: 환불/차지백 종료(`report(null)`)는 이전엔 무토스트였고 이제 "Dashboard updated" 1회 — F1-63 의도와 일치. app-t104 통과(토스트 관련 정적 검사 포함).
4. F1-22: `openCaseCount`가 done 아닌 분쟁 항목을 셈(빼기 아님), 배지·칩 아래 글·"N open cases" 모두 `useSavings().done` 기반. F1-16 sticky 제거(CSS), F1-33 `.weekly-link`·storeLine 제거.
5. 범위: `862a3b3..410bb36`에서 `_server/**`(send/mode/activity/today), `cases/reply/**`, `cases/progress/**`, `desk-model.ts`, `draft-forecast.tsx` 변경 0. 수정 파일 모두 허용 폴더(+ reports, inventory 3행). 옛 테스트 수정(t067/t076/t079/t091/t102/today)은 sticky 제거·링크→버튼·`aria-current`→`aria-pressed`·storeLine prop 제거 등 지시서 요구 구조 변경에 따른 것이며 회귀를 가리지 않음(안전 검사는 유지). en/ko 키 627/627 동일. 병합 커밋 ab5c724/f3d1c1f: case-detail.tsx·savings.tsx 충돌 흔적 없음.
6. 렌더 루프: 새 파일에 useEffect 없음. `select/setSku`는 useCallback, context value useMemo, 렌더 중 setState 없음.
7. 명령(f3d1c1f): tsc 0 / lint 0 / test:acceptance 15파일 177 통과(9 skip) / UI 4파일 62 통과 / npm test 2552 통과 1 실패(storefront 결정론 100회, 부하 시간초과) → 단독 31/31 통과 / build 통과.

## 주의 (결함 아님)
- 위 1번의 AI 호출 증가는 캐시 미적중 + recording/한도 상황에서만 비용이 됨. 브라우저 확인 때 서버 로그/`data/ai-cache` 적중 확인 권장.
- 환불/차지백 종료 시 새 토스트(위 3번).
