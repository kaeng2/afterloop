# T113 보고 (2026-11-12 11:15)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / ff4b30f (코드) + 이 보고서 커밋

## 결과
완료 (브라우저 재확인은 컨트롤 타워 몫). ① ko 문구 자리표시자 버그는 고쳤고 시험으로 확인했다. ② React #310은 브라우저 없이 **재현하지 못했다.** 관찰과 맞는 원인을 하나 찾아 막았다 — 아래 "원인 2". 컨트롤 타워가 브라우저로 꼭 다시 봐야 한다.

## 원인과 수정
1. **문구 자리표시자 (Desk "Application error"의 직접 원인)** — en과 ko에서 자리표시자가 다른 키가 두 개 있었다:
   `case.reply.editSub`(en `{{name}}`, ko 없음), `case.reaction.moodNext`(en `{{name}}`, ko 없음). 화면이 `{ name }`을 넘기면
   `t()`가 "없는 자리표시자를 넘겼다" 예외를 던진다 (서연·지호 둘 다 이름이 있다).
   → ko 값: `"자유롭게 고치세요 — 입력하는 대로 {{name}} 님의 반응이 바뀌어요"`, `"{{name}} 님의 다음 감정"`. `…Unknown` 키는 그대로(자리표시자 없음).
   전체 키를 비교해 보니 다른 키는 이 둘뿐이었다.
2. **React #310 (가장 유력한 원인, 브라우저 미확인)** — 문제가 난 주소는 모두 `(app)` 화면(`/`, `/products`)에 `?lang=`이 붙은 것이고,
   정상인 `/listing`·`/intro`는 `(app)` 밖이다. `(app)` 화면은 `(app)/loading.tsx`의 Suspense 안에서 `applyLangParam`이
   `redirect()`를 던진다. 그러면 HTTP 307이 아니라 **브라우저 쪽 router 이동**이 된다(`/lang` → 쿠키 → 같은 화면).
   이 소프트 이동 동안 트리가 en에서 ko로 바뀌고, 위쪽 막대 활동 서랍이 마운트할 때 부르는 서버 액션(`loadActivityView`)과
   같은 시간에 돈다. 로딩 경계가 없는 `/listing`·`/intro`는 첫 바이트를 보내기 전에 `redirect()`가 나므로 그냥 307이다.
   코드에서 언어에 따라 hook 수가 달라지는 곳은 찾지 못했다 (조건부 hook 없음, 컴포넌트를 함수로 부르는 곳 없음, lint 통과).
   → `(app)` 화면 4개(`/`, `/products`, `/cases/[id]`, `/preview/styleguide`)는 `?lang=`이 있으면 `<LangRedirect>`만 그린다.
   이 컴포넌트는 `window.location.replace('/lang?…')`로 **전체 페이지를 이동**한다(router를 쓰지 않는다). 기다리는 동안 `common.loading` 한 줄만 보인다.
   `/listing`·`/intro`는 지금처럼 `applyLangParam`(307)을 쓴다. `?lang=` 주소를 만드는 방법은 순수 함수 `langRedirectTarget`으로 뺐고,
   만드는 주소는 전과 같다.
   - 영향: 쿠키로 언어를 고르는 경우(언어 버튼 → 쿠키 + reload)는 바뀌지 않는다. `?lang=` 주소만 한 번 더 이동한다 (빈 화면 → 307 → 목적지).
   - 그래도 #310이 남으면 (원인이 다른 곳이면) 컨트롤 타워가 브라우저 콘솔의 개발 빌드 오류(컴포넌트 이름)를 알려 주길 바란다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `config/copy.ko.json` | `case.reply.editSub`·`case.reaction.moodNext`에 `{{name}}` |
| `src/app/_shared/lang-param.ts` (새 파일) | `langRedirectTarget(pathname, searchParams)` — `?lang=ko\|en` → `/lang?set=…&next=…`, 아니면 `null` |
| `src/app/_shared/lang-redirect.tsx` (새 파일) | `LangRedirect` 클라이언트 컴포넌트 — `location.replace`로 전체 페이지 이동 |
| `src/app/_server/locale.ts` | `applyLangParam`이 `langRedirectTarget`을 쓴다 (동작 같음). 주석: 로딩 경계 없는 화면만 쓴다 |
| `src/app/(app)/page.tsx`, `products/page.tsx`, `cases/[disputeId]/page.tsx`, `preview/styleguide/page.tsx` | `applyLangParam` 대신 `langRedirectTarget` → `<LangRedirect>`, 없으면 `initLocale()` |
| `tests/unit/app-t113.test.ts` (새 파일) | 재발 방지 시험 10개 (아래) |

재발 방지 시험 (`app-t113.test.ts`):
- T113-1: en·ko 키 집합이 같고, **모든 키**의 자리표시자 집합이 같다. 이름 규칙 키(`editSub`·`moodNext`·`title`)는 `{{name}}`, `…Unknown`은 자리표시자가 없다.
- T113-2: 정적 검사 — `src/app` 전체에서 `t('키', { … })` 호출이 넘기는 이름이 두 언어 문구의 자리표시자와 같다 (50건 넘게 검사).
- T113-3: ko로 정적 렌더할 때 예외가 없다 — Desk 답장 칸(서연, 이름 있음·없음), 예상 반응 상자(이름 있음·없음), 위쪽 막대, `/products`, `/listing`, `/intro`.
  Desk 전체(`CaseDetail`, 서버 컴포넌트 + PayPal 로더)와 지호의 offer 카드는 정적 렌더로 그리지 않았다. 대신 지호 화면을 죽이던 같은 두 키는 T113-1·2·3이 덮는다.
- T113-4: `(app)` 화면은 `applyLangParam`을 쓰지 않고 `LangRedirect`를 쓴다. 주소를 만드는 규칙. `LangRedirect`가 router를 쓰지 않는다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | |
| npm test | 2594 | 1 | `storefront.test.ts` "결정론 100회"가 전체 실행 때 시간 초과. 따로 돌리면 31/31 통과 (지시서: storefront 흔들림은 따로) |
| npx tsc --noEmit | 예 | 0 | |
| npm run lint | 예 | 0 errors | 경고 2건은 원래 있던 것 (`app-t098a-scenes.test.ts`) |
| npm run build | 예 | 0 | |

실제 AI·PayPal 호출 없음, 개발 서버 없음, `.env`를 읽지 않음.

## 남은 문제
- **#310은 브라우저에서 확인하지 못했다.** 컨트롤 타워가 같은 headless 재현 표(`/?item=PP-R-GMS-10197661&lang=ko`, `/?item=PP-R-MBJ-10197650&lang=ko`, `/products?lang=ko`, `/listing?lang=ko`, `/intro?lang=ko`)로 다시 봐 주길 바란다. 쿠키만 ko로 두고 `?lang=` 없이 연 경우도 함께 봐 주면 원인 2가 맞는지 구분된다.
- 영상·캡처 도구가 `?lang=` 주소를 쓰면 한 번 더 이동한다. 네트워크가 멈출 때까지 기다리면 된다.

## 컨트롤 타워에 요청할 결정
- 없음. (참고: `?lang=` 처리를 `src/middleware.ts`로 옮기면 모든 화면에서 렌더 전에 307이 된다. 이게 가장 깔끔하지만 내 수정 가능 폴더 밖이라 하지 않았다.)
