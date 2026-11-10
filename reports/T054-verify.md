판정: 실패

## 근거
- 범위: 변경 3개 파일(commitments.ts, commitments.test.ts, T054-impl.md)뿐. SPEC 첫 줄 v2.7 일치.
- npm test 1440 통과/0 실패(종료 0), tsc 0, lint 0, test:acceptance 155 통과/9 skipped/0 실패(종료 0).
- 테스트 diff는 추가만 있다(삭제 줄 없음).
- 지시서 "고칠 것" 표현 전부(refund/reship/replacement/discount/free_shipping/compensation x en/ko/ja/de, 약 60개): 모두 기대 범주로 잡힘.
- "잡히면 안 되는 것" 12개와 서연 답장 3개(영어 초안, 한국어 전송본 2개): 모두 빈 배열. 병합 차단 사유 없음.
- 토큰/자리표시자 무시 OK. 대소문자 무시 OK. 결정성 OK.
- 실패 사유: 완료 기준 "정규식은 입력 길이에 선형" 위반(아래 1번).

## 발견한 문제
1. [병합 차단 — 성능 완료 기준 위반] 숫자 20000자 뒤에 ` percent`가 붙은 입력(예 `"1"*20000 + " percent"`)에서 시간이 이차로 늘어난다. 20k자 377ms(기준 100ms 초과), 200k자 40,692ms(약 108배). 원인: `\d+(?:\.\d+)?\s{0,2}percent\s{1,4}off`의 `\d+` 앞에 경계가 없어 시작 위치마다 다시 훑는다. 다른 나쁜 입력(send 반복, a new 반복, 공백, 줄바꿈, ⟦ 반복, 돌려 드리 반복, another one, at no, shipping is on 반복)은 20k자 0.3~1.2ms, 200k자 3~7ms로 선형(약 8~15배). 실제 초안에서 일어날 가능성은 낮지만, 지시서가 명시한 기준이고 외부 글이 섞이면 서버가 멈출 수 있다. 수정: `\d{1,9}`로 상한을 두거나 `(?<!\d)` 경계를 앞에 붙인다.
2. [병합 후 수정 — 돈이 드는 약속을 놓침] 
   - `I can give you $5 off` -> [] (`$N off`)
   - `free return label` -> []
   - `we'll cover return shipping` -> [] (`cover the shipping`만 있고 `return`이 끼면 놓침)
   - `전액 돌려 드릴게요` -> [] (돈/금액/결제 낱말이 없으면 안 잡힘)
   - `新しい商品をお送りします` -> [] (`を送`만 있고 `をお送り`는 없음)
   - `Wir schicken Ihnen ein neues Paket` -> []
3. [기록만 — 잡는 쪽 오탐] 
   - `your refund request` -> refund
   - `we do not offer discounts` -> discount (부정문이므로 의도대로)
   - `교환·환불 규정은 상품 페이지에 있어요` -> refund, replacement
   - `추적 링크를 다시 보내 드릴게요`, `답장을 다시 보내 드릴게요` -> reship (사실만, 헷갈리면 잡는 원칙)
   - `Please send it back to us`, `I will send you the tracking link`, `I'll get back to you` -> []
4. 참고(통과): 돌려 쓴 약속 중 `I'll send out a replacement`(replacement), `we will ship a new one`(reship), `you'll get your money back`(refund), `I'll refund the shipping`(refund), `take 15% off`(discount), `결제하신 금액을 돌려 드리겠습니다`, `새 상품으로 다시 보내 드릴게요`, `쿠폰을 드릴게요`, `배송비는 저희가 부담할게요`, `返金いたします`, `Wir erstatten Ihnen den Betrag`는 모두 잡힘.

## 구현 보고서 대조
- "서연 답장 3개와 금지 목록 모두 빈 배열", "기존 기대값 변경 없음", 테스트 숫자(1440/155/9 skipped): 사실.
- "정규식 입력 길이에 선형 / 2만 자 100ms": 숫자 나열 입력에서는 사실이 아님(1번). 보고서의 2만 자 테스트가 이 입력을 다루지 않았다.
- "표현 전부 각 범주로 잡힌다": 지시서 목록 기준으로는 사실. 변형(2번)은 일부 놓친다.
- 보고서의 "잡아야 하는 글 47개/잡히면 안 되는 글 17개"는 개수를 세어 보지 않았다(확인 못 함).

## 확인하지 못한 것
- 구현 테스트 파일의 실제 케이스 수, 실제 AI 호출(금지), 다른 숫자/기호 조합의 최악 입력 전수. 종료 코드는 별도 재실행으로 모두 0 확인.
