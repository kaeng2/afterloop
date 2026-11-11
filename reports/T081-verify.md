# T081 검증 (커밋 77f0f80, 독립 검증)

## 판정: 실패 (열린 리다이렉트 1건 — 수정 필요). 나머지는 모두 통과.

## 항목별 근거
1. 명령 (검증 사본, 실제 AI/PayPal·개발 서버 없음)
   - `npm test`: 56 파일 2220 통과 / 실패 0 (storefront 시간 초과 없음). `npx vitest run`(전체): 70 파일, 2387 통과, 9 skipped, 실패 0.
   - `npx tsc --noEmit`: 오류 0. `npm run lint`: 출력 없음(오류 0).
   - `npm run test:acceptance`: 167 통과, 9 skipped, 실패 0.
   - `npm run build`: 성공 (`/lang` 라우트 추가).
2. 불변 영역: `git diff f693b06 77f0f80 --name-only`에서 src/engine·ai·paypal·exec·src/types.ts·tests/acceptance·_server/send.ts·mode.ts·activity.ts 변경 0건. 서버 액션 4개+activity-actions는 맨 앞에 `await initLocale()` 한 줄만 추가, 인자·반환 무변경. 통과.
3. 수정 폴더: 변경 31개 파일은 src/app/**, config/copy.*.json, tests/unit, reports/T081-impl.md뿐. intro.*.json 변경 0. 통과.
4. 언어 결정: `parseLocale`은 'ko'만 ko, 그 외 en. 주소(`?lang=`)→`/lang`이 쿠키를 써서 되돌림 → 주소가 쿠키보다 우선. 통과.
   **/lang 리다이렉트는 열린 리다이렉트 (아래 문제 1).**
5. 키: en 537 = ko 537, 차이 0. ko 값이 en과 같은 키 18개 — 보고서 목록과 일치(nav.appName, nav.appNameAccent, shell.lang.en/ko, today.peakDate, today.sellerTimeZone, today.dateOnly, common.noValue, case.view.sideCaption/points/causeSide/causeCodes, product.row.values, today.row.who, case.head.title, case.curve.fromTo, case.work.ai, case.reply.rushedExample). 대부분 설정·기호·이름 성격; `case.reply.rushedExample`만 문장(구매자에게 나가는 영어 답장 예)이라 의도 확인 필요(사소). ko diff는 새 키 3개(화면 언어, EN, 한국어)뿐 — 환불 약속·숫자 없음.
6. 버튼: `<button type="button" aria-pressed>` 2개(role=group, aria-label), 키보드 기본 지원, focus-visible 있음. 색은 var(--color-accent)/--color-on-accent만; PayPal 파랑 5개 값 grep 0건. intro 버튼도 같은 쿠키 사용.
7. `grep -rl -E "AFTERLOOP_|DEMO_MODE|LLM_API_KEY|client_credentials|api-m.sandbox" .next/static`: 결과 비어 있음 (exit 1).

## 발견한 문제
1. **[높음/보안] `/lang`의 `next` 검증이 열린 리다이렉트를 막지 못함** — `src/app/lang/route.ts`는 `startsWith('/') && !startsWith('//')`만 검사한다. `new URL(safe, request.url)`은 WHATWG 규칙대로 `\`를 `/`로 취급하므로 직접 실행해 확인: `next=/\evil.com` → `http://evil.com/`, `next=/<TAB>/evil.com` → `http://evil.com/` (탭·개행은 URL 파서가 제거). `//evil.com`, `https://evil.com`은 `/`로 막힘(정상). 수정 제안: `\`와 제어문자 거부, 또는 `new URL(next, request.url).origin === request.nextUrl.origin` 확인 후 `pathname+search+hash`만 사용. 단위 테스트에 `/\evil.com`·`/\t/evil.com` 추가.
2. [낮음] `/cases/[disputeId]`와 `/preview/styleguide`는 `applyLangParam`을 부르지 않아 그 주소의 `?lang=ko`는 무시된다(쿠키는 동작). 지시서 3번 "주소 우선" 취지상 사소한 누락(Today·Products·intro는 동작).
3. [낮음] 버튼 클릭이 `window.location.reload()` 전체 새로고침 (보고서에 이미 명시). 
4. [참고] 실제 브라우저 시각 확인은 이 검증에서도 하지 않음(개발 서버 금지).

## 재검증 (커밋 6ea2fa5)

### 판정: 통과

1. 명령: `npm test` 57 파일 2232 통과 / 실패 0 (storefront 시간 초과 없음), `npx tsc --noEmit` 오류 0, `npm run lint` 오류 0, `npm run test:acceptance` 167 통과·9 skipped·실패 0, `npm run build` 성공.
2. 열린 리다이렉트: `src/app/_server/safe-next.ts`(역슬래시·제어문자·공백 거부, `//` 거부, origin 비교)를 읽고, 임시 vitest(검증 후 삭제)로 route `GET`에 직접 넣어 확인. `/\evil.com`, `/\tevil.com`, `/\t/evil.com`, `/\n/`, `/\r/`, `/ /evil.com`, `//evil.com`, `https://evil.com`, `javascript:alert(1)`, `/.//evil.com`, `/..//evil.com`, `/./\evil.com` -> 모두 `/`. `/%5Cevil.com`, `/%2F%2Fevil.com`, `/%09/evil.com`, `/%0a/evil.com`은 인코딩된 채 같은 origin 경로(`localhost:3000/%5Cevil.com` 등)로 가며 외부로 가지 않는다. `/products?item=x`는 그대로. 17건 모두 origin 동일.
3. `applyLangParam` 호출: `cases/[disputeId]/page.tsx`, `preview/styleguide/page.tsx`에 추가됨.
4. `git diff aca0596 6ea2fa5 --stat`: 7개 파일(리포트, 두 page, safe-next.ts, route.ts, 테스트 2개)만. 엔진·AI·PayPal·exec·types·acceptance·send/mode/activity 변경 0. (기존 테스트 app-today.test.ts에 `_server/locale` import 허용 1줄 완화 있음 — 지시 범위 내 합리적.)
5. `.next/static`에 금지 문자열 0건.
