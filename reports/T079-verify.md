판정: 통과

# T079 검증 (8809501, 독립 확인)
1. 범위: 바뀐 파일은 src/app/**, tests/unit/, reports/T079-impl.md 뿐. 엔진·AI·PayPal·exec·types.ts·설정 json·시드·인수 테스트 0줄. send.ts·mode.ts·activity.ts diff 없음. 페이지 5개는 (app) 그룹으로 이동(R81~100%, 내용 변경은 import 경로 수준). 기존 테스트 수정: 경로 변경, 어댑터 null 대체 시험에 forecaster/detector 주입, "어댑터=null" -> "=엔진 결과", 서버 어댑터 "몸통 null" 검사 삭제(server-only 검사는 유지; 지시 변경에 따른 것). 단언 약화로 보기 어려움.
2. 실행: npm test 2207 통과/0 실패, tsc 0 오류(빌드 후; 빌드 전엔 .next/types가 옛 경로를 들고 있어 오류 - 구현 보고와 같음), lint 0, acceptance 167 통과 + 9 건너뜀(AC13 실호출용) 실패 0 (AC33 포함), build 성공. 경로: ƒ /, ○ /intro(정적), ƒ /api/health, ƒ /cases/[disputeId], ƒ /preview/styleguide, ƒ /products - 주소 그대로. .next/static에서 AFTERLOOP_·DEMO_MODE·LLM_API_KEY·client_credentials·api-m.sandbox 0건.
3. 탐침(가짜만, 스크립트 삭제함):
 - 숫자: 가짜 초안 2종 모두 반응 막대 3680 = 선택지 Reply 3680 = recommend fight 3680, 화면 표기 모두 "$37".
 - 곡선: "Your draft" 큰 %(34%/36%) = 답장 예측 pChargeback = 선택지 차지백 %. 곡선 6점(사건 수와 같음).
 - 탓하는 문장 추가: 34% -> 59%, 36% -> 61%. Send 차단은 editGate 단위 시험(EDITED_KEY)에서 통과 확인 (코드 무변경).
 - 사건 요약: 가짜 LlmCaller 받은 글에 Seo-yeon·서연·Kim·Hannah·Fernwood 모두 없음, 토큰 채움 "Seo-yeon is waiting.", 예외 시 null.
 - /intro: 루트 layout·intro에 Today/PayPal 읽기 코드 없음, (app)/layout에만 있음. 0회 시험은 app-t079 통과.
 - aiDrafts: 캐시 draft_en 수 3 = 어댑터 3. 파일 없음/항목 0 -> null, 칸 숨김(aiDraftsCounted=false).
 - Assumption 배지: app-t079 시험(곡선·선택지·반응 막대·입력칸 모서리) 통과.
4. translated: replyTranslated(ko)=참, en/null/""=거짓 한 함수. case-detail.tsx가 한 번 정해 곡선(anchor)·선택지(loadMoveForecasts)·답장 칸(forecastBase.translated)에 같은 값 전달. translated 참/거짓에 따라 예측값이 달라짐(0.343 vs 0.362)이므로 같은 값 사용이 의미 있고 일치함.

메모(실패 아님): 곡선의 마지막 빈 글 점과 답장 칸의 늦은 날 정의가 다름(구현 보고에도 기재). 내 탐침의 "customs office's fault" 문장은 blame 칩이 안 켜졌으나 위험은 올랐고, 구현 시험의 문장은 칩이 켜짐. 스크린샷은 없음.
