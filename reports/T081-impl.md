# T081 보고 (2026-11-11 21:40)

- 기준 SPEC: v2.11 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (커밋 직후 `git log -1`로 확인)

## 결과
완료. 위쪽 막대 오른쪽(판매자 칩 옆)에 `EN | 한국어` 버튼을 달았고, 고른 언어는 쿠키(`afterloop_lang`) 또는 `?lang=ko|en`으로 기억한다 (주소가 우선, 모르는 값은 영어). 화면 글자만 바뀐다 — 숫자·AI 글·구매자 원문·분쟁 번호·계산·보내기 관문·데모 모드는 건드리지 않았다. 실제 AI·PayPal 호출 0회, 개발 서버 안 씀.

## 동작 방식
- `t(key, params, locale = <요청 언어>)`: 세 번째 인자로 언어를 줄 수 있다. 안 주면 요청 언어, 요청 밖(시험·옛 호출)이면 영어 → 기존 호출은 영어 그대로.
  - 서버 층: `src/app/_server/locale.ts`의 `initLocale()`이 쿠키를 읽어 요청마다 한 칸(React `cache`)에 둔다. 루트 layout·`(app)` layout·Today/Products/intro page·서버 액션 4개가 맨 앞에서 부른다.
  - 클라이언트 층: 루트 layout의 `LocaleProvider`가 언어를 내려주고, 컴포넌트는 `useT()`로 쓴다. 컴포넌트 밖 순수 함수(`desk-model` 등)가 `t(key)`만 불러도 같은 언어가 나오도록 `LocaleProvider`가 렌더 첫머리에서 `setClientLocale`을 부른다.
- `?lang=ko`: page가 `/lang?set=ko&next=<원래 주소>` 로 보내고, `src/app/lang/route.ts`가 쿠키를 쓴 뒤 `lang` 없는 같은 주소로 돌려보낸다 (같은 사이트 안 경로만 허용). 그래서 주소가 쿠키보다 우선이고, layout(위쪽 막대)도 같은 언어를 읽는다.
- 버튼은 `aria-pressed`, 키보드(Tab·Enter·Space)로 고른다. 누르면 쿠키를 쓰고 `window.location.reload()`로 서버 글자를 다시 그린다. 색은 강조색 변수만.
- `/intro`의 기존 EN/KO 선택도 같은 쿠키·주소 값을 쓴다 (`한국어` 라벨로 맞춤).
- 파일 머리 주석("화면은 영어")을 고쳤다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_shared/copy.ts` | `t(key, params, locale)`, `Locale`·`parseLocale`·쿠키 이름·`setClientLocale`·`setLocaleResolver`, 머리 주석 |
| `src/app/_server/locale.ts` (새) | `initLocale`, `applyLangParam` |
| `src/app/lang/route.ts` (새) | 언어 쿠키 쓰고 되돌려 보내기 |
| `src/app/_shared/locale-context.tsx` (새) | `LocaleProvider`·`useLocale`·`useT` |
| `src/app/_shared/language-switch.tsx` (새) | `EN \| 한국어` 버튼, 쿠키 쓰기 |
| `src/app/_shared/top-bar.tsx`, `shell.css` | 버튼 배치·스타일, `useT()` |
| `src/app/layout.tsx` | 언어 읽기, `<html lang>`, 제목·설명도 언어별 (`generateMetadata`), `LocaleProvider` |
| `src/app/(app)/layout.tsx`, `(app)/page.tsx`, `(app)/products/page.tsx`, `intro/page.tsx` | `initLocale`/`applyLangParam` 호출 |
| `src/app/{cases,today,products,_shared}/…actions.ts` | 맨 앞에 `await initLocale()` (인자·반환 형태 무변경) |
| `src/app/cases/**`, `products/color-note-card·product-grid`, `today/tracking-register`, `_shared/activity-drawer` | 클라이언트 컴포넌트 `useT()` |
| `src/app/intro/intro-screen.tsx` | 공용 언어 값 사용 |
| `config/copy.en.json`·`copy.ko.json` | 새 키 3개: `shell.lang.label`·`shell.lang.en`·`shell.lang.ko` |
| `tests/unit/app-t081.test.ts` (새) | 아래 시험 |
| `tests/unit/app-intro.test.ts`, `app-t079.test.ts` | 정적 검사에서 `_server/locale` 허용, 루트 layout이 async가 된 것 반영 |

`_server/send.ts`·`mode.ts`·`activity.ts`, 엔진·AI·PayPal·exec 폴더, `config/intro.*.json`은 **수정하지 않았다**.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2387 | 0 | (9 skipped는 기존). 한 번 `storefront.test.ts` "100회 결정론"이 5초 제한에 걸렸으나 단독 재실행 31/31 통과 — 병렬 부하 탓의 기존 불안정 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run test:acceptance | 167 (9 skipped) | 0 | |
| npm run build | 성공 | 0 | `/lang` 라우트 추가 |

## 완료 기준 확인 (tests/unit/app-t081.test.ts)
- ko/쿠키 ko → ko, 없거나 모르는 값 → en: `parseLocale`·`t` 시험, 위쪽 막대를 en/ko로 그려 버튼 `aria-pressed`와 "Today (2)"/ko 문구 확인.
- 같은 분쟁(`CaseView`)을 en/ko로 그려 비교: 금액·%·분쟁 번호 목록 동일, 구매자 원문(한국어)·`⟦PCCC⟧` 가림 동일, 글자는 다름.
- 정적 검사: 서버 데이터 함수·보내기 관문 파일(`send.ts`·`today.ts`·`disputes.ts`·`mode.ts`·`activity.ts`·forecast/history source)에 언어 읽기 없음; 서버 액션 시그니처에 언어 인자 없음; `src/engine`·`paypal`·`exec`는 copy·locale·쿠키를 모름.
- en/ko 키 집합 같음 (537개). ko 값이 영어 그대로인 키 18개 (모두 설정·기호·이름·형식 성격):
  `nav.appName`, `nav.appNameAccent`, `shell.lang.en`, `shell.lang.ko`, `today.peakDate`, `today.sellerTimeZone`, `today.dateOnly`, `common.noValue`, `case.view.sideCaption`, `case.view.points`, `case.view.causeSide`, `case.view.causeCodes`, `product.row.values`, `today.row.who`, `case.head.title`, `case.curve.fromTo`, `case.work.ai`, **`case.reply.rushedExample`** (구매자에게 나가는 영어 답장의 "나쁜 예" 문장 — 영어로 보여 주는 것이 맞다고 판단해 유지; 아니면 알려 주세요).

## ko 문구 점검
기존 ko는 이미 키 전체가 한국어였고 시안 v4 `DI.ko`와 용어가 맞았다 (답장 필요·예방·일상, 이번 주 DisputeLess, 분쟁 위험, 분쟁 위험 변화 등). 그래서 새로 채운 값은 없고, 시안 ko 중 결정과 어긋나는 것(환불 약속, "11/5 약속", 근거 없는 숫자)은 쓰지 않았다. "사건 기록"(시안은 "히스토리")과 출처 배지 5종 이름은 기존 ko 값을 유지했다 (지시서: 배지 이름 유지).

## 남은 문제
- 버튼을 누르면 전체 새로고침(`window.location.reload()`)이다. `router.refresh()`로 하면 부드럽지만 기존 단위 테스트의 `next/navigation` 가짜(usePathname만 있음)와 충돌해 새로고침으로 했다. 영상에서 거슬리면 알려 주세요.
- 위쪽 막대 상단의 `generateMetadata`(제목)는 언어를 따르지만, `/intro`·`/preview/styleguide`의 고정 `metadata.title`은 영어 그대로다 (정적 문자열).
- 서버 층의 "요청 언어"는 React `cache`에 의존한다. layout·page가 동시에 돌아도 둘 다 같은 쿠키를 읽어 같은 값을 쓰므로 결과는 같지만, 새 서버 액션·page를 만들면 맨 앞에서 `initLocale()`을 불러야 한다 (안 부르면 영어).
- 실제 브라우저 화면 확인(스크린샷)은 하지 않았다 (개발 서버 금지). 버튼 모양·위치는 휴대폰 폭에서 보기를 권한다.

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC 무변경).
