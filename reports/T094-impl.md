# T094 구현 보고 (Scene 3 모션, SPEC v2.15)

## 결과
완료. 계산은 엔진(`createListingSim`/`checkListing`)이 그대로 하고, 진행 표시 속도만 시안(70ms 타이머)으로 바꿨다.

## 바뀐 것
- `config/motion.json` (새 파일, `scene3` 키만): `check {intervalMs:70, step:5}`, `recalc {intervalMs:70, step:25}`. Desk 키는 없음 — T090 병합 때 합친다.
- `src/app/listing/progress.ts`: requestAnimationFrame 대신 타이머(`TimerApi`)가 울릴 때마다 `sim.step(설정 step)`을 부르고 그 반환값을 진행으로 알림. 500에 닿으면 `sim.result()` + `listingFixGains`를 함께 전달. `prefers-reduced-motion`이면 타이머 없이 끝까지 계산해 바로 결과.
- `src/app/listing/listing-screen.tsx`: `frames` 대신 `timer` 주입, `paceFor(run.purpose)`로 속도 선택 (recalc만 +25, 나머지 점검 속도).
- `src/app/listing/listing.css`: 게시 점 `ls-pulse 1.2s`, `prefers-reduced-motion`에서 listing의 animation·transition 모두 끔. (점검 창 `up .45s`, `spin 1.2s`, 막대 `width .5s`, 입력칸 flash 1.2s는 T087/T089에서 이미 있어 그대로.)
- `tests/unit/app-t087-listing.test.ts`: 가짜 타이머로 교체. 70ms 간격·+5씩 100번·500에서 결과=`checkListing`, Recalculate +25, 설정값 변경 시 속도 변경, reduced-motion 즉시 결과, 정적 검사(타이머는 `progress.ts`에서만, 속도는 `config/motion.json`).

## 확인
`npm test` 2323 통과, `npx tsc --noEmit` 0, `npm run lint` 0, `npm run test:acceptance` 177 통과(9 skipped 기존), `npm run build` 성공. 숫자·문구·정직성 문구 변경 없음. 실제 AI·PayPal 호출·개발 서버 없음.

## 알려 둘 것
- `config/listing-model.json`의 `progressChunkRuns`는 이제 화면에서 쓰지 않는다 (엔진 계약이라 지우지 않음).
- 입력칸 flash는 끝색이 `transparent`(시안은 흰색)로 T089 이전부터 그대로 — 흰 카드 위라 보이는 차이 없음.
- 첫 `npm test`에서 `storefront.test.ts` 결정론 시험이 5초 시간 초과가 한 번 났고(다른 작업과 겹친 부하), 재실행에서 통과했다.

## 컨트롤 타워에 요청할 결정
없음.
