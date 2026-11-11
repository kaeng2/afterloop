판정: 통과

# T058 검증

1. 범위: 5f46c61 차이는 reply-model.ts(+8/-2), tests/unit/app-case-reply.test.ts(+23), reports/T058-impl.md뿐. send.ts 변경 0줄. 화면 컴포넌트·reply-facts.ts 변경 없음.
2. 실행: npm test 1824 통과(종료 0), tsc 0, lint 0 (merge로 docs/design 제외 반영됨), test:acceptance 158 통과·9 skip, build 0.
3. 완료 기준: `extractTokens(draft.draftEn)`로 모델에서 거른 뒤 `.filter` — 컴포넌트는 그리기만. 날짜 토큰 없음/있음, 이름·서명 줄 테스트 추가되어 통과. facts 불변 확인 테스트 있음. send 관련 테스트 그대로 통과.
4. 엣지(임시 테스트, 삭제함): draft ok:false -> factRows [] , available false, 예외 없음. 모르는 토큰 ⟦FOO_9⟧·깨진 ⟦ 가 섞인 초안 -> 예외 없이 DATE 줄만 남음.
