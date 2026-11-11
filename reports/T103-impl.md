# T103 보고 (2026-11-12 06:40)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서와 같은 커밋)

## 결과
완료 — 원인은 Send 뒤 끝나지 않는 **기본 우선순위 갱신 루프**(effect → context → 재렌더 → effect)다. 이 갱신이 쉬지 않아 React가 그보다 낮은 우선순위인 라우터 전환(transition)을 렌더·커밋하지 못했다. 루프를 끊는 두 군데를 고쳤다. 모양·문구·동작은 그대로다. 브라우저 재현 확인은 컨트롤 타워 몫이다 (이 세션은 개발 서버를 띄우지 않았다).

## 원인 (한 줄)
`ReplyPanel`이 렌더할 때마다 `CaseProgress`에 **새 `scenarioInput` 객체**를 넘겼고, `CaseProgress`가 그 때문에 새 `trail` 배열을 만들어 `setTrail`을 부르고, `ReplyPanel`이 그 context를 읽으니 다시 렌더 → 끝없는 루프.

## 근거 (파일:줄, 고치기 전 코드 기준)
1. `src/app/cases/reply/reply-panel.tsx:891-895` (수정 전) — `<CaseProgress scenarioInput={forecastBase === null || … ? null : { text: anchor, … }} />`: 렌더마다 새 객체 리터럴.
2. `src/app/cases/progress/case-progress.tsx:244` — `points = useMemo(() => scenario(scenarioInput), [scenario, scenarioInput])`: 입력 참조가 바뀌면 새 배열.
3. `src/app/cases/progress/case-progress.tsx:279-282` — `trail = useMemo(() => riskTrail(state, points), [state, points])` + `useEffect(() => setTrail(trail), [trail, setTrail])`: 새 배열이면 매번 `setTrail`.
4. `src/app/cases/view/draft-forecast.tsx` (수정 전 `useState` setter 그대로) — 내용이 같아도 새 배열이면 상태가 바뀌어 context 값(`useMemo [forecast, trail]`)이 바뀐다.
5. `src/app/cases/reply/reply-panel.tsx:481` — `ReplyPanel`이 `useDraftForecast()`를 읽는다 → context가 바뀌면 다시 렌더 → 1번으로.

이 고리는 Send 성공 뒤 `CaseProgress`가 그려질 때만 생긴다 (`reply-panel.tsx` `sendState === 'done'` 분기). 그래서 Send 하지 않으면 링크가 정상 동작한다 — 지시서 재현 3번과 맞다.

### 지시서 관찰과 맞춰 보기
- **DOM 변화 0회**: 값(점 확률)은 같고 참조만 새로워서, 렌더·커밋은 반복되지만 DOM에 바뀌는 것이 없다.
- **라우터 전환이 시작/커밋되지 않음**: Next 15.5 라우터는 `startTransition` 안에서 상태를 바꾼다 (`node_modules/next/dist/client/components/app-router-instance.js` `dispatchAction`, `use-action-queue.js`의 `use(state)`). 이 루프의 갱신은 passive effect에서 나오는 기본(Default) 우선순위라 늘 transition보다 먼저 뽑히고, 끝나지 않으니 transition이 굶는다. 운영 빌드는 "Maximum update depth" 경고도 내지 않는다 (passive effect 중첩 경고는 개발 모드만).
- **headless에서 RSC GET이 아예 안 나감**: `loading.tsx`가 있는 동적 페이지는 새 항목 데이터를 layout-router가 **렌더 중에** 가져온다. transition 렌더가 시작되지 못하면 GET도 안 나간다. 다른 브라우저에서 GET이 나간 경우도 커밋 단계에 이르지 못해 화면이 그대로였다.
- **그 뒤 현재 주소 RSC GET 한 번 더**: 라우터 큐의 refresh(`needsRefresh`) 같은 부수 동작으로 보인다. 원인 판단에는 쓰지 않았다 (확인하지 않은 추정).

## 고친 것
1. `src/app/cases/view/draft-forecast.tsx` — `sameTrail(a, b)`(길이·값 비교)를 추가. `setTrail`을 `useCallback`으로 감싸 내용이 같으면 **이전 상태를 그대로 돌려준다** (React가 재렌더를 건너뛴다). 단계가 늘어 점이 늘면 그대로 갱신된다 (T098b 동작 유지).
2. `src/app/cases/reply/reply-panel.tsx:667` — `scenarioInput`을 `useMemo([forecastBase, anchor, board, translated])`로 고정하고 `:901`에서 그 값을 넘긴다. 값 자체(보낸 글 = 기준 초안)는 같다. hook은 조기 return 앞에 둔다.

둘 중 하나만으로도 루프는 끊기지만, 같은 모양이 다시 생기지 않도록 두 겹으로 막았다.

무변경 확인: `_server/send.ts`, `mode.ts`, `activity.ts`, `case-progress.tsx`, `sent-state.tsx`, `today/savings.tsx` 모두 그대로다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/view/draft-forecast.tsx` | `sameTrail` + 같은 내용이면 갱신하지 않는 `setTrail` |
| `src/app/cases/reply/reply-panel.tsx` | `scenarioInput` useMemo로 고정 (`ScenarioInput` 타입 import) |
| `tests/unit/app-t103.test.ts` | 새 테스트 5개: `sameTrail` 단위 3개(같은 입력의 새 객체 → 새 배열이지만 같다고 보는 재현 포함), 정적 검사 2개(setTrail 가드, CaseProgress에 객체 리터럴 금지) |
| `reports/T103-impl.md` | 이 보고서 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | |
| npm test | 2493 | 2 | 아래 설명. 내 변경과 무관한 엔진 성능 시간 제한 |
| npx vitest run tests/unit/app-t103.test.ts | 5 | 0 | |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |

`npm test` 실패 2개 (전체를 병렬로 돌릴 때만):
- `tests/unit/sim.test.ts` "성능 … 한 번이 50ms 이내" — 60~64ms로 기준을 넘었다.
- `tests/unit/storefront.test.ts` "결정론 > 같은 입력 100회" — 5초 시간 제한 초과.

두 파일 모두 따로 돌리면 통과한다 (`sim` 31/31, `storefront` 통과). 둘 다 `src/engine`과 `seed`만 import하고 이번에 바꾼 `src/app` 파일은 import하지 않는다. 그래서 시간 기반 테스트가 기계 부하 때문에 흔들린 것으로 본다. 고치기 전 코드로 전체를 다시 돌려 비교하는 것은 이 세션 권한으로 할 수 없었다 (파일을 잠시 되돌리는 명령이 승인되지 않았다). 그래서 "원래부터 실패했다"는 확인하지 못했다.

## 남은 문제
- 브라우저 재현 확인 (Send → 지호·추적 링크 이동, "Done today · Simulated"·"+$N just now"·진행 표시·곡선 점이 그대로인지)은 컨트롤 타워가 한다.
- jsdom 같은 DOM 테스트 환경이 없어서 렌더 루프를 직접 세는 테스트는 만들지 못했다. 대신 루프의 고리(새 참조 → 같은 내용)를 순수 함수와 정적 검사로 막았다.
- `sim`·`storefront` 시간 기반 테스트는 병렬 실행 때 흔들린다 (engine 레인 몫. 이번 작업 범위 밖).

## 컨트롤 타워에 요청할 결정
- 없음
