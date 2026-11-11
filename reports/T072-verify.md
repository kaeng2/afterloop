판정: 통과

대상: 55cf9b1 (diff 22d9a36..55cf9b1). 코드·설정·테스트 수정 0. 개발 서버·AI·PayPal 호출 없음.

1. 범위
- 바뀐 파일 7개: config/copy.{en,ko}.json (product.fix.effect.on/off 두 키만), reports/T072-impl.md, src/app/products/{model.ts, products-screen.tsx, views.tsx}, tests/unit/app-product.test.ts. 모두 허용 범위.
- _server·엔진·AI·PayPal·params/rules json·시드·인수 테스트·grid.ts·product-grid.tsx 0줄.
- en/ko 키 391개씩, 차이 없음.
- 기존 테스트 변경: "두 값 나란히" 카드 단언 1개가 fixSavings 한 숫자 단언으로 교체. 약해진 단언 없음 (source 단언 유지, 텍스트·문구 단언 추가). 나머지는 신규 테스트 5개 추가 (32→37).

2. 실행
- npm test: 45 파일 2026 통과 / 0 실패 (storefront 100회도 통과, 재실행 불필요)
- npx tsc --noEmit: 오류 0
- npm run lint: 오류 0
- npm run test:acceptance: 158 통과, 9 skip, 0 실패
- npm run build: 성공

3. 완료 기준 (엔진 값 대조 스크립트, 라이브 config, 가디건, 실행 후 삭제)
- 처방 0개: 켠 처방 0, 큰 숫자 as-is $216, after null. 카드 = could save $46/$66/$19/$79 (cents 4637, 6602, 1917, 7862) = fixSavings 0개 결과와 일치.
- 4개: 켠 4, after $44. 카드 = saving $46/$28/$11/$45 (4643, 2810, 1147, 4460) = fixSavings 4개 결과와 일치.
- products-screen 처음 상태 useState<FixId[]>([]) 확인.
- 정적 검사: model.ts는 fixSavings의 savingCents를 money()로 옮기기만 함, 빼기 패턴 없음. views.tsx·model.ts에 금액 숫자 리터럴 없음. 카드 텍스트는 copy 키 {{saving}} 치환.
- AG Grid: grid.ts·product-grid.tsx 변경 0 (With fixes·깜빡임 코드 그대로).

참고(비차단): 실제 브라우저에서 토글 클릭·"Turn all on" 동시 깜빡임은 이번 검증에서 확인하지 않음 (서버 금지).
