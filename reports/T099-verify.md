# T099 검증 (커밋 1446df1, 기준 27491c5)

판정: **통과**

1. 명령: tsc 0, lint 0, build 성공, test:acceptance 177 통과(9 skip) 실패 0. `npm test`는 2422/2423 — 실패 1건은 storefront "결정론 100회" 5초 시간 초과(알려진 부하 flake)이고 단독 재실행 31/31 통과.
2. 미리보기 제목: en "{{name}} will see ({{language}})", ko "{{name}} 님에게 보이는 글". 대명사 없음. reply-panel은 buyerShort(이름만) 전달, 이름 모르면 기존 buyerReadsUnknown. app-t099 시험이 서연·지호 각각 확인.
3. src/app/(app)·today·cases에서 /products·/listing 링크 0건 (grep 히트는 주석·(app)/products/page.tsx 자체의 import·applyLangParam 경로뿐, href·Link·push 아님).
4. Prevent 카드: 손실은 pickPreventProduct, 절감은 fixSavings 값 그대로 옮김, 버튼·링크·폼 없음(쓰기 0). 시안의 "Ask 3 Korean buyers…"·save 72 미사용.
5. nav-items의 /products 항목 제거(Today만). send.ts·mode.ts·activity.ts·데모 모드 diff 0. 숫자 로직 변경 없음.
6. 범위: 17개 파일(config copy, today model/card/css, (app)/page.tsx, nav-items, reply-panel 1줄, 시험, inventory, impl 보고). reply-panel은 제목 한 줄만 — Send·editGate 무변경.

메모(문제 아님): nav.products 문구 키는 남아 있음(미사용). 화면은 띄워 보지 않음.
