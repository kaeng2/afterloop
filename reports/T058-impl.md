# T058 구현 보고

- 기준 SPEC v2.9 = SPEC.md 첫 줄 v2.9 (일치)
- 변경: `src/app/cases/reply-model.ts` — `factRows`를 영어 초안(`draft.draftEn`)에 `extractTokens`로 실제 쓰인 토큰만 남기도록 거름 (날짜·구매자 이름·서명 같은 규칙). 사실값(`facts`)·`send.ts`·화면 컴포넌트는 그대로.
- 테스트: `tests/unit/app-case-reply.test.ts`에 2건 추가 (날짜 토큰 없으면 DATE 줄 없음/있으면 있음 + facts 불변, 이름·서명 줄 같은 규칙).
- 결과: `npm test` 1824 통과, `tsc --noEmit` 0, `test:acceptance` 158 통과(9 skip), `npm run build` 성공.
- `npm run lint`: error 1건 — `docs/design/mockup-v3/vendor/react-dom.js`(no-require-imports). 수정 금지 폴더 `docs/`의 기존 파일이라 내 변경과 무관, 건드리지 않음. **컨트롤 타워에 요청할 결정**: lint 제외 목록에 `docs/design/**` 추가 필요.
- 스크린샷은 찍지 않음 (컨트롤 타워가 찍는다).
