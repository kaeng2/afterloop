# T102 검증 보고 (010c45b)

판정: **통과**

## 근거
1. 시안 동작: `done-groups.ts` regroupDone — 끝낸 항목은 원래 묶음에서 빠지고 맨 뒤 done 묶음, 빈 묶음 제외, done 힌트 null, sku 거르개는 서버 묶음(이미 거른 값)을 받으므로 done에도 적용. today.css: `.today-item-done{opacity:.55}`, `.today-dot-done`·`.today-group-done .today-group-bar` = `var(--color-line)`, globals.css:48 값 `#cfd3d8` 확인.
2. 정직: 모두 simulated면 `today.group.doneSimulated`, 섞이면 `today.group.done` + simulated 줄에만 `case.progress.simulated`. reply-panel.tsx:709 `next.mode === 'simulated'` — SendOutcome(reply-model.ts:62)에 실제 값. tracking-register.tsx `next.kind === 'simulated'` — TrackingOutcomeKind에 실제 값. markDone은 `next.ok` / `countsAsDone(kind)`(added|simulated) 안에서만 호출 — 실패·차단·취소·일부 실패 경로에서는 불리지 않음.
3. 화면 상태만: 추가된 fetch·use server·server-only·_server·paypal import 없음 (diff grep). 항목 값은 그대로 옮김. send.ts·mode.ts·activity.ts 무변경. 변경 파일은 허용 폴더 안 (+ 기록용 DECISIONS.md·TASKS.md·tasks/T102.md·reports).
4. en/ko 키 603개 동일, 새 키 2개씩.
5. 실행: tsc 0 오류, lint 0, test:acceptance 15 파일 통과, build 성공(REAL_SEND=0, TRACK_LIVE=0). `npm test`는 storefront.test.ts "결정론 100회" 시간 초과 1건만 실패 → 그 파일만 재실행 31/31 통과 (알려진 부하 flaky).

## 결함
없음. 참고: reply-panel.tsx 변경이 "한 줄"이 아니라 3곳(markDone 한 줄 + unmarkDone 구조분해·다시 쓰기 호출) — 스펙이 허용한 "끄면 더 좋다" 범위.
