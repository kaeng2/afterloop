# T103 검증 보고

판정: **통과**

## 1. 렌더 루프 사슬 (수정 전 682e662 기준)
모든 고리 확인됨. 틀린 고리 없음.
- reply-panel.tsx:891-895 — `scenarioInput`에 렌더마다 새 객체 리터럴을 넘김 (CaseProgress는 `sendState==='done' && outcome.ok` 분기에서만 그려짐 → Send 전엔 링크 정상, 재현 3번과 일치).
- case-progress.tsx:244 — `points = useMemo(scenario(scenarioInput), [scenario, scenarioInput])`. `scenario`는 기본값 모듈 상수라 안정, `scenarioInput`만 매번 바뀜 → 새 배열.
- case-progress.tsx:279-282 — `trail = useMemo(riskTrail(...), [state, points])` → `useEffect(setTrail(trail), [trail, setTrail])`. `riskTrail`은 `number[]`를 새로 만든다 (progress-model.ts:286-293).
- draft-forecast.tsx (수정 전) — `useState` setter 그대로: 새 배열이면 (내용이 같아도) 상태 변경 → context value(useMemo [forecast, trail]) 변경.
- reply-panel.tsx:481 — `ReplyPanel`이 `useDraftForecast()`를 읽음 → 재렌더 → 다시 새 객체. 루프 성립.
- 참고: case-detail.tsx는 서버 컴포넌트("use client" 없음)라 `board`·`forecastBase` 프롭은 클라이언트에서 참조가 안정적.
- 한계: 브라우저 라우터 굶김(transition 우선순위) 설명은 코드만으로 확인 불가 — 컨트롤 타워 브라우저 확인 몫. 루프 자체는 코드상 실재.

## 2. 수정이 루프를 끊는가
- (a) draft-forecast.tsx:19-24 `sameTrail`: 참조 같음 → true, 길이 다르면 false, 각 원소 `Object.is` 비교. 원소는 number(pChargeback)라 값 비교로 충분. `setTrailState(now => sameTrail(now,next) ? now : next)` — 같으면 이전 상태 반환 → React bail-out, context 불변. `setTrail`은 `useCallback([])`로 참조 안정, `value` useMemo 의존에 포함. 이것만으로 루프 끊김.
- (b) reply-panel.tsx:667 `scenarioInput` useMemo `[forecastBase, anchor, board, translated]`: 모두 원시값/서버 직렬화 프롭 유래(`board = base.board`, `translated`는 boolean, `anchor`는 문자열)라 렌더 간 안정. 조기 return(842 이후 / 893 Send 분기)보다 앞(667)에 있어 hooks 규칙 위반 없음. (a)가 단독으로 성립하므로 (b)는 보강.
- 동일 내용 재설정되는 다른 효과: `setForecast(forecast)`는 `forecast` useMemo로 안정 — 문제 없음.

## 3. 동작 불변
- 점이 늘면(길이 다름) `sameTrail` false → 갱신됨, T098b 유지 (app-t098b 8개 통과). 언마운트 `setTrail([])`도 정상 동작.
- diff는 src 2파일(reply-panel.tsx, draft-forecast.tsx) + 테스트 + 보고서만. 문구·JSX 무변경. send.ts / mode.ts / activity.ts 무변경. 범위는 src/app/**, tests/unit/ 안.
- 새 테스트 app-t103 5개(단위 3 + 정적 2)는 jsdom 없이 루프 고리를 막는 수준. 렌더 횟수 직접 측정은 없음(구현자도 명시).

## 4. 실행 결과 (f27effb)
- `npx tsc --noEmit` 통과
- `npm run lint` 통과 (출력 없음)
- `npm run test:acceptance` 177 통과 / 9 skipped / 실패 0
- vitest t103+t098b+t102 29개 통과
- `npm run build` 통과
- `npm test` 2494 통과 / 1 실패: storefront.test.ts "결정론 100회" 5초 타임아웃(머신 load 약 21). 단독 재실행도 6초대로 타임아웃. 수정 전 682e662에서도 같은 테스트가 실패(1회)·통과(2회) 혼재 — 5.4~6.1초로 임계(5초) 부근. 해당 테스트는 src/engine만 import, 이번 변경과 무관한 flaky. sim 50ms는 이번엔 통과.

## 결함
없음.
