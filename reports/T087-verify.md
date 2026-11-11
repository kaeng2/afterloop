# T087 검증 (92de883, 기준 6d16001)

판정: 통과

1. 시험·빌드: npm test 2304 통과 + storefront 결정론 1건 시간 초과 → 단독 재실행 31/31 통과. tsc 0, lint 0, test:acceptance 177 통과(AC34 포함, 9 skipped 원래부터), build 0.
2. 화면 무계산: listing 폴더에 setInterval·setTimeout·확률 계산 없음. 진행 n = rAF마다 sim.step(chunk) 반환값. 형식 함수는 반올림·표기만. 점 200개 배치(dotsFor)는 엔진 byType 건수를 그림 칸에 나누는 배치 로직이며 숫자로 보이지 않음 (경미).
3. 정직성: 금지 문구 4종 없음. dataV = "Assumed rates (planning draft) · {{runs}} simulations" + Assumption 배지. lossTip의 fee/refundShare/time은 자리표시자(params). BF 안내 숫자 없음. 숫자 옆 AssumptionBadge 12곳.
4. AI: 서버 액션 → listingFixesFor → draftListingFixes 1회, 입력 상품명+설명(zod), llm 없으면 null. 판정은 detectListingFeatures.
5. API: zod strict, 400 invalid_input, checkListing 직결, PayPal·AI import 없음.
6. /listing은 (app) 밖, Today·PayPal 호출 없음. 메뉴 Black Friday rehearsal → /listing, Products 링크 유지. en/ko 키 133개 동일. .next/static에 금지 문자열 0.
7. 범위: 22개 파일 모두 수정 가능 폴더(top-bar, copy, listing config, public/listing, tests, 보고서). 엔진·AI·PayPal·계약·인수 테스트 변경 0. 단 tests/unit/app-today.test.ts 1줄(메뉴 이름 기대값) 수정 - 허용된 tests/unit 안이고 키 의미 변경에 따른 것.

미확인: 화면 배치(1920/1440/390)는 실행 금지라 못 봄.
