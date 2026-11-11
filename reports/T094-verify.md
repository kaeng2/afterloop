# T094 검증 (1348426, 기준 8e3f7db)

## 판정: 통과 (모션 항목 중 2건은 시안과 값이 다름 — 아래, 막는 수준은 아님)

## 1. 명령
- npm test: 첫 실행에서 `storefront.test.ts` 결정론(100회)만 시간 초과 1건(2회 재실행도 전체 실행 중에는 같은 시험이 걸림). 단독 재실행은 31/31 통과. sim.test.ts 단독 41/41 통과. 나머지 2322 통과.
- tsc --noEmit(build 뒤) 0, lint 0, test:acceptance 177 통과(9 skipped), build 성공. app-t087-listing 25/25.

## 2. 계산 / 진행
- progress.ts: 타이머 한 번에 `sim.step(pace.step)` 호출, 진행값은 step 반환값. 결과는 `sim.result()`(createListingSim) + listingFixGains, sim.done()일 때만 onDone. 진행 값이 결과를 바꾸는 경로 없음.
- paceFor: recalc는 `motion.scene3.recalc`(70ms/+25), 그 외 `scene3.check`(70ms/+5). 시험으로 간격·+5·500·설정 변경 확인.
- 참고: 시안의 recalc 간격은 60ms, 과제는 70ms — 과제대로 70ms.

## 3. 시안 모션 대조
| 시안 | 구현 | 결과 |
|---|---|---|
| 점검 창 up .45s cubic-bezier(.2,1,.3,1) | ls-up .45s 같은 곡선 | 있음 |
| spin 1.2s linear infinite | ls-spin 1.2s | 있음 |
| 단계 ○ → ● → ✓ | model.ts mark todo/now/done, 뷰 ○●✓ | 있음 |
| 결과 막대 width .5s ease | .ls-bar-fill | 있음 |
| flash #E3F3FF → #FFF 1.2s | ls-flashA/B 1.2s, 끝색 transparent(흰 카드 위라 동일) | 있음 |
| 게시 점 pulse 1.2s | ls-pulse 1.2s ease-in-out infinite, 그러나 효과가 outline-color 깜빡임 | 값 다름: 시안 `pl`은 opacity .5↔1 + scale .92↔1.06 (시안은 분석 아이콘 svg에 씀) |
| 진행 막대 `transition: width .07s linear` (시안 522행) | `.ls-prog-fill`에 transition 없음 | 빠짐 |
| 칸 transition .3s (bg+transform), 유형 칸 .4s | 있음 | 있음 |
| rise .4s | ls-rise .4s | 있음 |

빠진/다른 것: (a) 진행 막대 width .07s linear 전환 없음, (b) pulse가 시안 `pl`(opacity+scale)과 다른 효과.

## 4. reduced-motion
CSS: `[class^='ls-'],[class*=' ls-']`에 animation/transition none !important. progress.ts: reduced면 타이머 없이 끝까지 계산해 onProgress(total) + onDone 즉시. 시험 있음. 통과.

## 5. 숫자·문구·정직성
model.ts·listing-view.tsx 변경 없음(diff 0줄). 문구·숫자 무변경. `config/motion.json`은 `scene3` 키만.

## 6. 범위
diff stat: config/motion.json, reports/T094-impl.md, src/app/listing/{listing-screen.tsx,listing.css,progress.ts}, tests/unit/app-t087-listing.test.ts. 범위 안.

## 환경 메모
verify-tmp3의 수정 사본 reports/T089-verify.md를 스크래치(/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/T089-verify.md.bak)에 백업 후 checkout. 복원은 호출자 판단.
