# T102 보고 (2026-11-12 06:20)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 683608d (구현) + 이 보고서 커밋

## 결과
완료 (스크린샷만 빠짐 — 컨트롤 타워가 캡처). 답장 Send 성공·추적 등록 성공(가짜 포함) 순간에 그 항목이 Today 목록 맨 아래 "Done today" 묶음으로 옮겨진다. 화면 상태만이며 새로고침하면 원래대로 돌아온다. 모두 가짜 전송이면 제목이 `Done today · Simulated`이고, 실제 전송과 섞이면 `Done today` 제목에 가짜 전송 줄에만 작은 `Simulated`가 붙는다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/done-groups.ts` (새) | 순수 함수 `regroupDone(groups, done)`: done 항목을 원래 묶음에서 빼서 맨 아래 `done` 묶음에 넣고(원래 목록 순서), 빈 묶음은 뺀다. 제목 키는 `doneSimulated`/`done`, 줄별 `simulatedLabel`. 항목 값은 그대로 옮긴다 |
| `src/app/today/today-groups.tsx` (새, client) | 묶음 카드·항목 줄(이전 `today-list.tsx`의 `GroupCard`/`ItemRow`를 옮김). `useSavings().done`을 읽어 다시 묶는다. done 줄은 `today-item-done` class, 점은 `today-dot-done`, done 묶음은 힌트 없음. `TodayGroupsView`(done 표를 직접 받음, 테스트용) |
| `src/app/today/today-list.tsx` | 서버 컴포넌트 유지. 묶음 부분만 `<TodayGroups>`(client)로 바꿈 |
| `src/app/today/savings.tsx` | `SavingsProvider`에 `done`·`markDone(itemId, {simulated})`·`unmarkDone(itemId)` 추가 (화면 상태만) |
| `src/app/cases/reply/reply-panel.tsx` | `next.ok`일 때 `markDone(disputeId, { simulated: next.mode === 'simulated' })` 한 줄. 다시 쓰기(`again`)에서 `unmarkDone` (지시서 "끄면 더 좋다") |
| `src/app/today/tracking-register.tsx` | `doneId` prop. `countsAsDone(next.kind)`일 때 `markDone(doneId, { simulated: kind === 'simulated' })` |
| `src/app/today/tracking-detail.tsx` | `doneId={TRACKING_ITEM_ID}`를 넘김 (page.tsx의 TrackingDetail 줄은 T067 정적 테스트가 고정하므로 여기서 넘김) |
| `src/app/(app)/page.tsx` | 주석 한 줄만 |
| `src/app/today/today.css` | `.today-item-done{opacity:.55}`, `.today-dot-done`·`.today-group-done .today-group-bar` = `var(--color-line)`(#cfd3d8), `.today-item-simulated` |
| `config/copy.en.json`·`copy.ko.json` | 새 키 `today.group.done`(Done today / 오늘 완료), `today.group.doneSimulated`(Done today · Simulated / 오늘 완료 · 시뮬레이션). 줄별 글은 기존 `case.progress.simulated` 재사용 |
| `tests/unit/app-t102.test.ts` (새) | 아래 완료 기준 전부 (16개) |
| `reports/screens/T102/README.md` | 스크린샷 없음 — 컨트롤 타워가 캡처 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | |
| npm test | 2490 | 0 | 74 파일. 첫 실행에서 `storefront.test.ts` 결정론 테스트가 5초 시간초과로 한 번 실패했고, 다시 돌리자 통과 (이번 변경과 무관한 엔진 테스트) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | `AFTERLOOP_REAL_SEND=0 AFTERLOOP_TRACK_LIVE=0`를 앞에 붙인 명령은 권한에서 막혀 환경 변수 없이 `npm run build`로 돌림 |

완료 기준 대조:
- [x] 묶기 순수 함수: done 없음 = 지금과 같음 / 분쟁 1개 done → 맨 아래 done / 빈 묶음 없음 / sku 거르개 적용 / 모두 simulated → `doneSimulated`, 섞임 → `done` + 줄별 Simulated
- [x] 컴포넌트·정적: 흐림 .55·점·막대 #CFD3D8, 힌트 없음, 실패·차단·확인 취소에서 markDone 없음 (`if (next.ok)` 안, `countsAsDone` 안)
- [x] 화면 상태만: 새 파일에 fetch·서버 액션·PayPal 없음. 항목의 상태·위험·숫자 필드는 건드리지 않음 (정적 검사)
- [x] en/ko 키 집합 같음
- [ ] 스크린샷 — **컨트롤 타워가 캡처** (개발 서버·실제 PayPal 읽기 금지 때문에 Send 뒤 화면을 이 세션에서 띄울 수 없음)
- [x] npm test / tsc / lint / acceptance / build 실패 0

## 남은 문제
- 스크린샷 미작성 (위 참고).
- `sku` 거르개는 서버가 이미 거른 묶음을 다시 묶는 방식이라, 거르개를 바꾸면(주소 이동) done 표는 남아 있고 거른 결과에 맞게 다시 묶인다. 새로고침하면 사라진다 (지시서대로).
- 추적 항목은 결과가 `added`·`simulated`일 때만 done으로 옮긴다. `failed`·`nothing`·`unavailable`·`error`는 옮기지 않는다 (`countsAsDone` 기준 그대로).

## 컨트롤 타워에 요청할 결정
- 없음
