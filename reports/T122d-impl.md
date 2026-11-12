# T122d 보고 (2026-11-12 20:59)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-desk / (이 보고서 커밋 — `git log -1 lane/ui-desk`)

## 결과
완료 — 4개 모두. 단 2번(Avg. dispute risk)은 T120d `meanRisk`가 아직 main·이 브랜치에 없어 **자리만 두고 "—" 유지** (lane/engine `214a3c9`에 있음 — 병합 뒤 한 줄 교체, 아래).

## 할 것별
1. **위험 단계 config**: 새 `src/app/today/risk-level.ts`가 `config/motion.json` `desk.riskLevel`(0.45/0.20)을 zod로 읽는다 (`_shared/motion.ts`는 수정 범위 밖이고 그 스키마가 모르는 키를 지우므로 따로 읽음). 목록 칩·All products 표(`.hi` 줄, 막대·%는 `riskChipParts` 경유)·사례 위험 상자 "지금 %" 글자색(`desk-model.ts` `headlineTone` 한 곳 → `riskLevelTone`)이 같은 기준. 알약·입력칸 테두리 빨강(`riskColor` 0.5)은 config 설명대로 그대로 둠.
2. **Avg. dispute risk**: `overview-model.ts` `kpis.topRisks` = 상품 줄마다 최고 위험(엔진 무응답 pChargeback) 목록(값 없는 줄 제외). `overview.tsx`가 `dashboardMeanRisk(kpis.topRisks)`(`src/app/today/mean-risk.ts`)를 부르고 `null`이면 "—". 지금 자리 함수는 `null`을 돌려준다. **T120d 병합 뒤** `mean-risk.ts` 한 곳만: `import { meanRisk } from '@/engine/mean-risk'; export const dashboardMeanRisk: MeanRiskFn = meanRisk;` (시그니처 `(readonly number[]) => number | null` 동일 확인).
3. **Lena·Yuki 데모 항목**: `buildToday`가 시드 `seedDemoDisplay.demoItems`(T121)를 넣는다 (`TodayInput.demoItems`로 바꿀 수 있음, `_server/today.ts`는 손대지 않음).
   - **id = 시드 `key`: `lena`, `yuki`** (T122c `DemoItemCardItem.key`와 같음). `kind: 'demo'`, `item.demo` = 시드 줄 그대로(`DemoItemCard`의 `item` 모양과 호환).
   - Lena → Reply needed (분쟁 뒤·Mike 앞, 시안 ITEMS 순서), Yuki → Questions. 상태 알약 `badge.demo`(Demo data), 점 회색, 위험 값 없음 → 칩 없음 (시드·엔진 값 없음, 시안 RISKP 31%·6%는 지어내지 않음). 열 때 `CaseDetail`(PayPal 읽기)을 부르지 않는다.
   - 줄: 머리 `#1029`/`#1051`, 상품 이름·아이콘은 시드 SKU(FK-BN-SET/FK-CD-OAT), 범주·구매자는 시드 en/ko. 열린 분쟁 수·상품 칩 사건 수에는 넣지 않는다 (PayPal 사건 아님). Today (N)은 7.
   - `page.tsx` `Pane`: `kind === 'demo'`면 지금은 `null` (카드는 T122c). **병합 때 이을 한 줄** (주석에 적어 둠): `item.demo === undefined ? null : <DemoItemCard item={item.demo} row={item.row} doneId={item.id} />`.
4. **Mike 칩 없음**: `risk-source.ts`가 이미 Routine을 뺀다 — 변경 없음, 시험으로 고정.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/risk-level.ts` (새) | `desk.riskLevel` 읽기, `riskLevelOf`·`riskLevelTone` |
| `src/app/today/risk-values.tsx` | 칩 단계 = `riskLevelOf` |
| `src/app/cases/desk-model.ts` | `headlineTone` 한 줄 → `riskLevelTone` |
| `src/app/today/mean-risk.ts` (새) | 엔진 `meanRisk` 자리 (지금 `null`) |
| `src/app/today/overview-model.ts` | `kpis.topRisks`, 데모 항목 구매자 열 |
| `src/app/today/overview.tsx` | 평균 카드 = 엔진 자리 값 / "—" |
| `src/app/today/model.ts` | `kind: 'demo'`, `TodayDemoItem`, `STATUS_DEMO`, `demoItem()`, `buildToday` 연결 |
| `src/app/(app)/page.tsx` | 데모 항목 상세 자리 (`null`, 병합 메모) |
| `tests/unit/app-t122d.test.ts` (새) | 위 4개 |
| `tests/unit/app-today·t061·t076·t122b.test.ts` | 목록에 Lena·Yuki가 들어간 v6 기대값으로, 단계 기준 45% |
| `tests/unit/app-t091.test.ts` | `typeOutTiming` 기대값 32ms·1글자 (컨트롤 타워 config 변경 `bc19d4c` 뒤 이미 실패하던 줄) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (9 skip) | 0 | |
| npx vitest run tests/unit | 2705 | 1 | `storefront.test.ts` "결정론 100회" 5초 시간 초과 — 병렬 부하 때만. 단독 실행 31/31 통과. 엔진 시험·이 작업과 무관 |
| npx tsc --noEmit | ✓ | 0 | |
| npm run lint | ✓ | 0 오류 | 경고 5 (기존 파일) |
| npm run build | ✓ | | |

실제 AI·PayPal 호출, 개발 서버, `.env` 읽기 없음.

## 남은 문제
- T122c 병합 시 `src/app/(app)/page.tsx` 데모 분기 한 줄 연결 필요 (T122c 범위에 page.tsx가 없음). `tests/unit/app-today.test.ts`는 T122c도 다른 곳(추적 표 줄)을 고쳐 충돌 가능성 낮음.
- T120d 병합 뒤 `src/app/today/mean-risk.ts` 교체 (위 2번). 그 전까지 Avg 카드는 "—".
- 한국어 화면에서 데모 줄 글은 `buildToday` 때 언어로 고른다 (기존 분쟁 줄 문구 방식과 같음).

## 컨트롤 타워에 요청할 결정
- 없음 (위 두 연결은 병합 작업).
