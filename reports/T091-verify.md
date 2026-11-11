# T091 검증 (e01e1f9, 기준 ad9fd7b)

판정: 통과 (코드·시험 기준. 화면 스크린샷·실제 눌러 보기는 하지 않음 — 개발 서버 금지)

1. 안전장치: send.ts·mode.ts·activity.ts·_server diff 0. 카드 고르기·Add/Remove 칩·환불 카드는 상태만 바꾸고 fetch/서버 액션 호출 없음(desk-selection·choice-cards·desk-actions grep). 환불 카드 = "Refund done · Simulated". 막힌 수 aria-disabled·onClick 없음. 타이핑 중 screenGate 막힘, editGate·detailsMustOpen 그대로. 추적 등록·offer 경로는 같은 액션·관문(tracking.ts는 sku·amount만 추가).
2. 화면 계산 없음: ppText는 엔진 deltaPp 반올림만, riskTone은 색 단계, moodBad = 엔진 moodBand angry(annoyedFrom -0.5), 환불 상태 큰 % = refundMoveText로 forecastMoves refund와 같은 글을 forecastReply에.
3. 문장: filledSnippets = reply-snippets.json만. "Refund backup"·"Expected delivery"(화면 문구) 0.
4. 모션 값 일치: typeOut 34/2, chipPop .45s cubic-bezier(.2,1.4,.4,1) + 0.12s 지연, lintRise .3s, color .3s, 알약 background-color .3s(editorBorder), caret .2s rotate(180deg), 반응 막대 세 칸 공통 .reaction-seg width .35s, riskColor 0.5/0.2, reduced-motion 변수 0s + 타이핑 바로 전체. 색 #C4321F/#000000/#0066F5/#0A1B3D 토큰 값 일치.
5. 병합: CaseProgress(T092) 있음, color-scheme: light 고정·prefers-color-scheme 0건(T096), acceptance 177 통과(AC33).
6. inventory.md: 전체 316행 중 빈 상태 칸 221 (Desk 67: 색 45·모션 13·접근성 1·조건 8, scene1 35, scene3 119 전부). 상태 있는데 근거 빈 행 0. Desk 표 3은 13/13 채움.
7. 시험: npm test 2414/2415 (storefront 결정론 100회 시간 초과 1건 → 단독 재실행 31/31 통과), tsc 0, lint 0, acceptance 177 통과(9 skip), build 통과. .next/static에 PAYPAL_CLIENT_SECRET·ANTHROPIC_·sk-ant 0.
8. 범위: 32개 파일(src/app·config·tests·inventory·보고). 엔진·send·mode·activity 0.

지적(차단 아님):
- 환불 카드 글에 "I have refunded the full amount" 문구(copy refundDraft) — 지시서 "환불 약속 없음"과 부딪칠 수 있으나 환불 완료(Simulated) 안내이고 Send는 관문으로 꺼짐.
- 환불 상태에서 칩·Details %p는 보이는 환불 안내 글 기준, 큰 %는 카드 기준 (보고서에 명시됨).
- 글을 바꾼 뒤 미리보기 "Translated to Korean when you send."와 Send 꺼짐이 어긋남(컨트롤 타워 결정 대기).
- 시안 그림자 일부를 outline으로 대체, "+$N just now"는 마지막 액션 하나만.
