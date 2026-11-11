# T100 검증 (verify-tmp3, 1fb18b8)

판정: 통과. 심각한 문제 없음.

- send.ts: 기준 대비 diff는 import 추가 + 파일 끝 "고친 글 입구" 절 추가뿐. 기존 sendReply·sendFromScreen·resolveSendMode·guardLiveSend·rememberReply 무변경. 새 입구는 PayPal 호출기를 받지 않고(GET load만) 검사 통과 글만 rememberReply 후 번호를 준다. 보내기는 그 번호로 기존 sendReply 관문. 클라이언트는 글자를 보내지 못하고 번호만 보냄(서버 기억 번호 + 분쟁 번호 일치 검사).
- 이름: 직접 시험(B01·B02 둘 다, 가짜 LLM 요청 전체 검사). Seo-yeon·서연·Ji-ho·지호·Hannah·Fernwood 0건. 다르게 쓴 이름(서연, 지호, Hannah, Fernwood, 대문자)은 AI 호출 0회로 거부.
- 검사: refund in full / promise a full refund / money back / replacement / reship / discount / guarantee / Guaranteed delivery / "It will arrive by Nov 20"(입력 거부) 전부 번호 없음 또는 sendable false, No new promises 실패. 서버(prepareEditedReply)에서 다시 검사함.
- 환불: editGate가 환불이면 Send 꺼짐 + 이유. 서버는 고친 글이 환불했다고 말하면 AI 호출 전 거부.
- 공개 모드: 시험 (a)에서 Simulated, live 0. 녹화 모드 관문 그대로 (t100 (e) 4건).
- AI 없음·한도 초과: Send 꺼짐 + 이유. AI 초안 그대로는 editGate가 기존 관문 그대로.
- 명령: npm test 2445 통과 / 1 실패(storefront 결정론 시간 초과, 단독 재실행 31 통과), tsc OK, lint OK, acceptance 177 통과(9 skipped), build OK, .next/static 금지어 0.
- 범위: 13파일 (send.ts, actions.ts, edited-reply.ts, reply-model.ts, reply-panel.tsx, copy en/ko, inventory.md, 시험 5). 범위 밖 없음.

낮은 심각도 메모
1. 서버는 "환불 카드가 선택됨" 상태를 모른다. 환불 상태 차단은 화면(Send 꺼짐)과, 서버에서는 고친 글이 환불했다고 말하는 경우만. 환불 카드를 고른 채 환불 문구 없는 글을 직접 서버 액션으로 보내는 것은 이전과 같이 가능(거짓 안내는 아님).
2. 이 사건의 값이 아닌 이름(예: 다른 구매자 이름)을 손으로 쓰면 그대로 AI에 간다 (알 수 없으므로 불가피).
3. 화면(스크린샷) 확인 안 함 — 개발 서버 금지.
