# T105 검증 (92c2d0e, 기준 862a3b3..92c2d0e)

판정: **통과** (결함 없음, 참고 2건)

## 항목별 근거
1. F3-10 통과. `desk-model.ts` `CURVE_X`·`curveStep`: 기본 칸 = 640/12, x = i*칸+8, 초안 점 = xOf(사건 수) (마지막 사건+칸). 사건 8개면 칸 53.33 고정, 오른쪽 약 1/3 빈칸. 사건 9개 이상일 때만 min(640/12, (640-8)/(n-1+4))로 칸을 줄임 — 사건 수로만 결정되는 순수 함수라 결정적이고 타당(초안+단계 4칸 확보). 좌표 toFixed(1) 방식도 시안과 같음.
2. F3-11 통과. 칸 너비가 trail 길이와 무관, 단계 점 x = draftX + (i+1)*칸*0.8 — 덧붙이기만 하고 앞 점 불변.
3. F3-17 통과. case.css에서 `.curve-ping`의 cx/cy transition과 `.curve-dot-draft`의 `transition: all` 제거. `.curve-draft` polyline의 `transition: all var(--motion-curve)` 유지.
4. F3-13 통과. `toneOf` 하나(buyer/bad/sys)를 곡선 점(`curve-dot-{tone}`)과 점줄(`history-dot-{tone}`)이 같이 씀. 색: buyer --color-text(#3F4144), bad --color-dot-high, sys --color-dot-neutral. 판매자 파랑(`history-dot-seller`)·검정(`curve-dot-seller_reply`) 삭제.
   - 보고(판단 안 함): seller_reply → bad는 시안 데이터와 맞음(시안에서 판매자 쪽 사건 "You replied…/You promised…"는 모두 who:'bad'). 단 시안에서 마지막 구매자 "chargeback 위협" 사건은 who:'buyer'인데, 구현은 flags에 threat가 있으면 bad (기존 규칙 유지). 시안 대비 한 점 색이 다를 수 있음.
5. F3-22/F4-32 통과. reply-panel: 빈 글이면 `forecaster`(엔진 forecastReply)에 빈 글 + `delayDays + noReplyDays`를 넘김 → 알약·곡선 초안 점·큰 %가 같은 forecast 값. 곡선 아래 "if no reply by {date}"(새 키 `case.curve.ifNoReply`), fromTo는 null. 날짜 = 오늘+2일(라벨 계산만). 확률 계산은 UI에 없음. `ReplyModelSchema`는 non-strict zod object라 `noReplyDays`를 버림; app-t105가 키 유무 forecastReply 결과 동일을 검증(통과). 엔진 코드 변경 없음.
6. 범위 통과. 변경 파일: copy en/ko(키 1개씩, 키 집합 604=604 동일), config/reply-model.json(키 1개), desk-model.ts, view/*(risk-curve, draft-forecast, case-view, case.css), reply-panel.tsx(+16/-5: import, emptyDraft, delayDays 가산, effect의 setNoReplyBy만), tests/unit/app-t105, reports. `_server/send.ts`·`mode.ts`·`activity.ts`·`progress/**` 무변경. inventory.md는 4행(#3F4144, transition all, sc-if risk.hasFrom 등 해당 항목)만 수정.
7. 렌더 루프 없음. `setNoReplyBy`는 문자열(원시값)이라 같은 값이면 React가 갱신을 건너뜀. effect 의존성 [forecast, setForecast, emptyDraft, setNoReplyBy]는 모두 메모/안정 값. Provider의 value는 noReplyBy가 바뀔 때만 새로 만들어짐. 글이 있는 상태에서는 null 고정. (참고: 자정을 넘기면 날짜 문자열이 한 번 바뀜 — 무해.)
8. 실행 결과: tsc 통과, lint 통과, test:acceptance 177 통과/9 skip, app-t105/t103/t098b 30개 통과, build 성공. `npm test`: storefront "결정론 100회"만 부하로 실패(알려진 flaky) — 단독 실행 31개 통과. (첫 실행에서는 2건 실패, 재실행에서 1건; 둘 다 부하 flaky로 판단, sim 50ms 건 재실행에서는 통과.)

## 결함
없음.

## 참고
- 체크아웃 시 untracked `reports/T103-verify.md`가 메인과 바이트 동일해 지우고 진행.
- 브라우저 시각 확인은 하지 않음(지시상 개발 서버 금지).
