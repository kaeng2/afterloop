# T122b 보고 (2026-11-12 20:50)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-desk / (이 보고서 커밋 — `git log -1`)
- 작업 폴더: `afterloop-wt/ui-color` (지시서의 worktree)

## 결과
완료 (화면 확인은 못 함). 범위 4·5·6을 시안 v6(`docs/design/mockup-v6/Desk.dc.html`) 기준으로 구현했다. 목록 위험 % 칩, Reply needed / Prevent / Questions / Done today 묶음, "All products" 전체 현황(요약 카드 5개 + **AG Grid 표 2개**), v6 상품 칩 동작이 들어갔다.
개발 서버를 띄우지 않았으므로(금지) 스크린샷 비교(T123)는 하지 않았다. 차이 목록 `reports/design-match/v6-diff.md`는 이 세션 권한으로 읽을 수 없었다 (afterloop/ 폴더 읽기 거부). 그래서 지시대로 v4와 v6 시안을 직접 비교했고, 이 범위의 행과 상태는 아래 "시안 대조"에 적었다. **판정은 T123 도구 결과로 해 주세요.**

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/model.ts` | v6 secs: 악용 의심으로 건너뛴 분쟁(Mike)을 **Reply needed 맨 뒤**로 옮김. `routine` 키는 "Questions" 자리(질문 항목이 없으면 묶음이 안 보인다). 엔진 판정·상태 알약·점은 바꾸지 않음 |
| `src/app/today/risk-source.ts` (새 파일) | 서버 전용. 분쟁마다 **T105 무응답 예측과 같은 호출**: `forecastReply({ text: '', anchorText, board, signals, delayDays: unansweredDays + noReplyDays, translated })`의 `pChargeback`. 입력은 `loadCase`·`loadReply`(사례 상세와 같은 요청 안 cache). Routine(Mike)·기준 초안 없음·예외는 값 없음 |
| `src/app/today/risk-values.tsx` (새 파일) | 값 상자. 서버가 Suspense로 따로 흘린 값을 한 번 넣는다 (같은 값이면 다시 넣지 않아 렌더 루프 없음). 단계·색은 `riskTone`(config/motion.json `desk.riskColor`)으로, 표기는 `toPercentRounded` |
| `src/app/today/today-groups.tsx` | 줄 셋째 칸 = 구매자 + 오른쪽 위험 % 칩 ("89% · High", lvl 색, `title` = riskTip). 값 없는 줄·끝낸 줄은 칩 없음 |
| `src/app/today/overview-model.ts` (새 파일) | 전체 현황 값: 항목 수 세기, 엔진 값 옮기기, 최댓값 고르기만 (평균 없음) |
| `src/app/today/overview.tsx` (새 파일) | 전체 현황: 제목·부제·"AG Grid" 꼬리표, 요약 카드 5개, AG Grid 표 "Products"·"Cases by risk". 시안 `.ag-hc` 머리 단추(↓/↑, 고른 열 파랑), 열 정렬(숫자·위험 ↓ 먼저 / 글자 ↑ 먼저, 정렬 없음으로 돌아가지 않음), 행 클릭·Enter/Space로 열기, 위험 막대 셀, 높은 위험 행 `.hi` 색, 마지막으로 연 행 강조, 아래 "N rows · Sorted by … ↓". 정렬 상태는 사건을 열었다 돌아와도 남는다 |
| `src/app/today/selection.tsx` | v6 동작: 상품 칩 → 그 상품의 첫 항목(Reply needed → Prevent → Questions, 끝낸 항목 제외). All products → 고른 항목 없음 = 전체 현황. `BackToAll`("← All products overview", 시안 L231), `DetailEmpty` = 시안 isEmpty 안내 |
| `src/app/today/screen-model.ts` | `firstItemFor`, `ALL_PRODUCTS_PARAM`. 주소의 All products = `?sku=all` |
| `src/app/(app)/page.tsx` | 처음 상태 = 시안 초기 state (`sku` 없으면 고른 항목의 상품 → 서연이면 Wool Sweater). 오른쪽: 전체 현황 → 돌아가기 → 빈 상품 → 상세 (같은 자리에 두고 보이기만 바꿈, T118). `RiskLoader`를 `<Suspense fallback={null}>` 안에 둠 |
| `src/app/_shared/grid/grid.ts` | 공용 래퍼에 추가: `deskGridTheme`(색은 desk.css `--dk-ag-*` 변수에서), 행 52 / 머리 38, `sortableCol`, 열 폭 `DESK_OV_COLS`(시안 pCols·cCols) |
| `src/app/(app)/desk.css` | **파일 끝 T122b 절**: v6 `<style>` L51-70(.ov-k·.ag·.ag-*) 그대로 + AG Grid 안쪽 맞춤 + 칩·카드·셀·빈 상품 규칙 (색은 모두 시안에 있는 값) |
| `config/copy.en.json`·`copy.ko.json` | `today.risk.*`, `today.ov.*`, `today.emptyTitle/emptySub` (DI.en/DI.ko 그대로). `today.group.routine` "Routine" → "Questions"/"단순 문의", 힌트도 시안대로. 키는 파일 끝이 아니라 `today.row.severalProducts` 바로 뒤에 넣었다 (다른 UI 세션과 병합 충돌을 줄이려고) |
| `tests/unit/app-t122b.test.ts` (새 파일) | 17개: 칩(값·단계·색·끝낸 줄·값 없음), 묶음 이름, risk-source 정적 검사, 전체 현황 값, AG Grid 열(정렬·처음 정렬·비교 함수·폭), 행 클릭 동작, 꼬리표·카드 5개·"N rows · Sorted by Dispute risk ↓", 칩 거르기·첫 항목·빈 상품·주소 |
| `tests/unit/app-today.test.ts`, `app-t061.test.ts`, `app-t076.test.ts`, `app-t106.test.ts`, `app-t081.test.ts` | v6 동작으로 바뀐 기대값만 고침: Mike가 Reply needed 맨 뒤, Routine 묶음 없음, 칩 → 첫 항목, `?sku=all`, ko=en 허용 키 3개(`today.ov.agTag` "AG Grid", `today.ov.none` "—", `today.risk.chip` 꼴) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 2620 | 2 | `sim.test.ts` 성능(50ms), `storefront.test.ts` 결정론(5초 제한). 둘 다 전체를 동시에 돌릴 때만 시간 초과가 나고, **따로 돌리면 72/72 통과**. 엔진 파일은 건드리지 않았다 |
| `npm run test:acceptance` | 179 (+9 skip) | 3 | 모두 **AC35 repair**(엔진 `repair` 수, T120 범위). 이 레인은 엔진을 건드리지 않았다 |
| `npx tsc --noEmit` | 내 파일 오류 0 | — | 남은 오류는 `src/app/cases/model.ts:224`, `cases/reply/load.ts`, `cases/view/load.ts`의 `'repair'`(계약 변경, T120c·T120b 범위)와 `.next/types` 옛 파일뿐 |
| `npm run lint` | 오류 0 | — | 경고 2개는 이 작업과 상관없는 `app-t098a-scenes.test.ts` |
| `npm run build` | 컴파일 성공 | 타입 검사 실패 | 원인은 위의 `src/app/cases/model.ts` `repair` (T120c). 그게 고쳐지면 다시 봐야 함 |

## 시안 대조 (v4 → v6, 이 범위. 판정은 T123 도구로)
| v6 시안 | 구현 상태 |
|---|---|
| L148 목록 셋째 줄 구매자 + 위험 % 칩, `riskSt`·lvl 색·riskTip | 구현. 값 = 엔진 무응답 pChargeback. **Mike·추적·Prevent는 칩 없음** (아래 남은 문제 1) |
| secs Reply needed / Prevent / Questions / Done today, secHint | 구현 (Mike는 Reply needed 맨 뒤, 시안 ITEMS 순서). Questions는 데이터가 없어 지금 안 보임 |
| L179-229 전체 현황: 제목·부제·AG Grid 꼬리표·.ov-k 5개·표 2개·.ag-f | 구현. 표는 진짜 AG Grid(공용 래퍼)이고, 시안 `.ag` 모양에 맞췄다 |
| kpis Avg. dispute risk | **"—"** (엔진에 평균 함수가 없다, 지시서대로). 아래 줄 "Riskiest case · N products"는 그대로 |
| cRows 끝낸 줄 위험 0% | **"—"** (엔진 값이 아니라서 0%를 지어내지 않았다) |
| sortHead ↓/↑·`.on`·두 방향만 오감·처음 risk ↓ | 구현 |
| pRows pick (상품 → 칩, multi → 가장 위험한 항목) · cRows pick | 구현 |
| L231 ← All products overview · L234-240 빈 상품 안내 | 구현 |
| pickProduct (칩 → 그 상품 첫 항목, all → sel null) | 구현 (T106 "칩을 눌러도 고른 항목 유지"는 v6 동작으로 바뀜) |
| 초기 state `{ sel: 'seo', sku: 'sweater' }` | 구현 (page.tsx). T122a 지시서 1번과 겹치지만 T122a는 이 파일을 고칠 수 없어서 여기서 했다 |

## 남은 문제
1. **Mike(악용 의심, Routine 상세) 위험 칩 없음.** 무응답 예측에는 기준 초안(anchorText)이 필요한데, Mike 상세는 답장 칸이 없어 AI 초안을 만들지 않는다. 칩 하나 때문에 LLM 호출을 늘리지 않았다. 추적·Prevent 항목도 엔진에 그 항목의 분쟁 확률 값이 없어서 칩이 없다 (지어내지 않음).
2. **단계 기준이 시안과 다르다.** 시안 `riskLvl`은 45% / 20%이고 riskTip 글도 "High 45%+"라고 한다. 그런데 config에 45% 기준값이 없다. 코드에 숫자를 쓰지 않으려고 이미 있는 config `desk.riskColor`(0.5 / 0.2, 시안 riskCol)를 썼다 → **45~49%는 시안에선 "High", 여기선 "Medium"**. 지금 값(서연 89% 등)에선 차이가 없다.
3. Questions 묶음은 질문 항목(Yuki #1051 등, T121 시드)이 `buildToday`에 들어와야 보인다. 그 연결을 맡은 지시서가 없다 (아래 결정 3).
4. 화면 확인 못 함. AG Grid 머리·행 높이·테두리를 시안 `.ag`에 맞췄지만, 실제 픽셀은 T123으로 봐야 한다. 휴대폰 폭에서는 표 최소 폭(약 850px) 때문에 표 안에서 가로로 넘긴다.
5. `desk.css` 끝 절과 `copy.*.json`은 T122a·T122c도 고친다. 병합할 때 줄 단위 충돌이 날 수 있다 (모두 덧붙이기라 풀기 쉽다).
6. 주소 바뀜: All products는 `?sku=all`이다. 주소에 `sku`가 없으면 처음 상태(고른 항목의 상품)가 된다. 그래서 옛 링크 `/?item=X`는 X의 상품 칩으로 열린다 (X가 한 상품에만 걸리지 않으면 All products + 돌아가기 단추).

## 컨트롤 타워에 요청할 결정
1. 위험 단계 기준 45% / 20%를 config에 둘지 (예: `config/motion.json` `desk.riskLevel: { highFrom: 0.45, midFrom: 0.2 }`). 근거: 시안 `riskLvl(p) = p >= 45 ? 'high' : p >= 20 ? 'med' : 'low'`와 riskTip 문구. 이 레인은 copy 말고 config를 고칠 수 없다.
2. "Avg. dispute risk" 카드: 엔진에 평균 함수(예: `src/engine` `meanRisk(values)`)를 둘지, 지금처럼 "—"로 둘지. 시안 = 상품 줄마다 최고 위험의 산술평균 (`avgR`).
3. Questions 묶음에 질문 항목(T121 데모 Yuki 등)을 넣는 `buildToday` 연결을 어느 지시서가 맡을지. `src/app/today/model.ts`는 이 레인 범위라서 지시가 오면 바로 할 수 있다.
4. Mike 칩: 값을 보이려면 Routine에도 기준 글을 정해야 한다 (예: AI 없이 고정 기준 글). 그 기준 글을 무엇으로 할지는 계약 판단이라 이 레인이 정하지 않았다.
