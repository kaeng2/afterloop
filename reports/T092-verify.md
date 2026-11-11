# T092 검증 (dd511f9, 기준 ad9fd7b)

판정: **통과** (경미한 지적 2건)

| # | 항목 | 결과 |
|---|---|---|
| 1 | PayPal 호출 0회·서랍 0줄 | 통과. 가짜 fetch·sendReplyAction spy 0회, `listActivity()` 빈 배열 (공개·녹화 모드 × 4단계 렌더 후). 진행 칸 파일은 서버 액션·fetch를 import/호출하지 않음. "POST carrier"·"customs-clearance" 문자열이 src·config 어디에도 없음 |
| 2 | 통관번호 원문 | 통과. src/config에 `P\d{8,}` 원문 없음, 모든 단계 HTML에 `P•••••••9012`만 (손님 답장 문장·영어 번역 포함) |
| 3 | 제목·Simulated·Auto·멈춤 | 통과. 제목 "What happens next · Simulated", Assumption 배지, 손님 답장부터 단계마다 Simulated, "Auto" 없음. 손님 답장 단계(shown 2)에서만 [Forward to carrier], 타이머는 누르기 전 더 이어지지 않음 (코드: shown 1에서만 타이머, forward() 안에서 다음 타이머) |
| 4 | 위험 %·금액 | 통과. 칩 10% → 3% → 0% = `scenarioRisk`(sent 35%는 시안처럼 칩 없음), 토스트 = `actionSavings` → `toDollarsRounded`. 화면에 계산 없음 |
| 5 | 모션 | 통과. 시안 값과 일치: 1300·(k−1)+400ms, step rise .45s cubic-bezier(.2,1.2,.4,1), ndot 1s 0.15s 간격(keyframes 0/80/100 .3, 40% −3px 동일), flash #60cdff→transparent 1.6s, 토스트 rise .35s·3000ms 뒤 사라짐, reduced-motion은 globals.css가 animation 끄고 간격 0. 모든 값은 config/motion.json `caseProgress` |
| 6 | 관문 | 통과. send.ts·mode.ts·activity.ts·actions.ts diff 0. reply-panel.tsx는 import 1줄 + `sendState==='done' && outcome.ok` 반환 블록 1개. 공개 모드(simulated)는 live=false → 보낸 줄·말풍선도 Simulated, 녹화(live)는 보낸 답장만 실제 |
| 7 | Replay | 통과(코드). onReplay → `again()` + 원문 복원 → 답장 칸. 타이머 정리 후 호출. (브라우저로 눌러 보지는 않음 — jsdom 없음, 개발 서버 금지) |
| 8 | 검사 | build 0, tsc 0, lint 0, npm test 68 파일 2389 통과 0 실패 (storefront 포함, 시간 초과 없음), acceptance 177 통과/9 skipped/0 실패. `.next/static` 금지 문자열 0 |
| 9 | 범위 | 12개 파일: config 3, progress 새 4(+css), reply-panel 전환 지점, 테스트 2, 보고·inventory. 범위 밖 코드 파일 없음 (motion.json은 지시서의 모션 절 몫, 새 키만) |

## 지적 (판정에 영향 없음)
1. reduced-motion에서 토스트가 보이자마자 사라짐: `later()`가 reduced면 지연 0으로 줄여 토스트 숨김 타이머(hideMs 3000)도 0ms가 된다. "모두 끈다"는 애니메이션만 끄는 뜻이면 숨김은 3초 유지가 맞다.
2. 보고서 스스로 밝힌 한계: 곡선 카드에 점이 단계마다 늘지 않음(끝점·큰 %만 이동), "+$N just now" 줄 없음 — 시안 대비 부분 구현, 후속 태스크 결정 필요.

참고: 내 검증용 보드에서 `actionSavings`가 0이라 토스트가 안 뜨는 경우(fight 아닌 수 등)는 엔진 값 그대로 숨김 처리됨 (cents > 0일 때만).
