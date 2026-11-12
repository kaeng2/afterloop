# T115 보고 (2026-11-12 11:30)

- 기준 SPEC: v2.15 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / (이 보고서 커밋 — `git log -1`. 구현 커밋 d3c9c66 · 380217a · fb9abe3)

## 결과
완료 — (3) 주소 이름, (2)-6 리다이렉트 버그, (2)-1·2·3·4·5·7 모두 구현하고 단위 시험을 붙였다. 단, `next.config.ts`는 이 worktree에서 편집이 잠겨 있어(권한 거부) 옛 주소 308은 라우트 핸들러로 만들었다 (아래 "남은 문제" 1).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/intro/*` → `src/app/demo/seller-dashboard/*` | 폴더 이동 (git rename). 상대 import 깊이만 고침 |
| `src/app/listing/*` → `src/app/demo/store/new-product/*` | 폴더 이동 (git rename). 상대 import 깊이만 고침, `applyLangParam(NEW_PRODUCT_PATH, …)` |
| `src/app/_shared/routes.ts` (새) | `SELLER_DASHBOARD_PATH`·`NEW_PRODUCT_PATH` |
| `src/app/_server/moved.ts` (새) · `src/app/intro/route.ts` · `src/app/listing/route.ts` (새) | 옛 주소 → 새 주소 **308**, 쿼리 그대로, **상대 경로 Location**. `/listing/*.jpg` 사진(public)은 그대로 |
| `src/app/lang/route.ts` | (2)-6 버그: `NextResponse.redirect(new URL(safe, request.url))` → `Location: <상대 경로>` 307. Render 안쪽 주소 `https://localhost:10000`로 안 튕긴다 |
| `src/app/demo/seller-dashboard/intro-screen.tsx` | ① 탭 5개·See all = `<a href="#" onClick={stay}>`(preventDefault) ② 벨·도움말·Transfer·Request = 일반 `<button type="button">`, `Inert`·aria-disabled 제거 ③ 말풍선 `<span>Open DisputeLess</span> →` ④ `router.prefetch('/?item=PP-R-GMS-10197661')` ⑤ 사건 줄·건수(배지 2곳·"N open"·Handle all N·말풍선 N cases)·BF 날 수를 `data` prop에서 |
| `src/app/demo/seller-dashboard/page.tsx` | `loadIntroData()`(동기, PayPal 안 부름) + `warmTodayReads()`(응답 뒤 `after()`) |
| `src/app/_server/intro-data.ts` (새) | 사건 줄 = 연결 표 `screenLinks()`(서연 먼저 → 지호 → 마이크) → 시드 분쟁·구매자·주문·상품. 기한 = 읽기 캐시의 분쟁 상세 **peek만**(`seller_response_due_date`, 없으면 buyer, 둘 다 없으면 "심사 중"), 캐시가 비면 `fallbackDue`. "repeat claim" = Desk `seedPriorInrDisputes`와 같은 셈. "mentions chargeback" = 엔진 `CARD_COMPANY_TERMS`. 데우기 = 응답 뒤 Today와 같은 `listDisputes`+`getDispute`(읽기 캐시 클라이언트) |
| `src/app/_server/read-cache.ts` · `paypal.ts` | `peek(path)` / `peekCachedRead(path)` — 담긴 값만 꺼내고 읽기를 시작하지 않는다 |
| `src/app/today/model.ts` | `peakDaysLeft(now)` 추출. `dateLine`(Desk 위쪽 막대)과 /demo/seller-dashboard가 같은 함수를 쓴다 |
| `src/app/demo/seller-dashboard/intro.css` | ⑦ `.intro:lang(ko){Noto 먼저}` 삭제 (루트 Figtree, 'Noto Sans KR' 그대로). `[aria-disabled]{cursor:default}`·button 탭 덮개 규칙 삭제 → 시안 `scene1.css` 규칙 그대로 |
| `config/intro.en.json`·`intro.ko.json` | `cases`·`openCount` 삭제, 문구에 `{{n}}`/`{{days}}` 자리, 사건 줄 문구 틀(caseTitle·caseSub·caseDue·caseNoDue·caseChargeback·caseRepeat·reasons), salesSubOne·salesSubPast, `targetDisputeId`, `fallbackDue` |
| `scripts/ai-cache/build-lib.ts` | **import 경로 2줄만** (`@/app/listing/*` → `@/app/demo/store/new-product/*`). 수정 가능 폴더 밖이지만 안 고치면 빌드·시험이 깨진다 — 아래 요청 2 |
| `tests/unit/app-t115.test.ts` (새) · `intro-sample.ts` (새) | 완료 기준 시험 17개 |
| `tests/unit/app-intro·t108-intro·t098a-scenes·t079·t087-listing·t109-listing-css·t067·shared-design·ops-t095` | 폴더 경로 변경, `data` prop·`useRouter` 가짜, T078 옛 기대(aria-disabled·2건·onClick 2개)를 T115 결정대로 |
| `reports/design-match/inventory.md` · `pixel/README.md` | 경로 → 새 주소·새 폴더. inventory Scene 1 "누를 수 있는 것" 절에 예외 행 "껍데기 버튼은 동작 없음 (사람 결정 11/12 11:20)" + 사건 줄 3개 출처. `reports/screens/design-match/README.md`는 옛 경로가 없어 그대로 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | 15 파일 |
| npm test | 2778 (9 skip) | 1 → 0 | 전체 실행 때 `storefront.test.ts` "결정론 100회"가 한 번 실패(흔들림, 지시서가 따로 보라 한 것). 따로 다시 돌리면 31/31 통과 |
| npx tsc --noEmit | ✓ | 0 | `.next/types`의 옛 /intro·/listing 경로 오류는 빌드가 다시 만들면 사라짐 (build 뒤 0) |
| npm run lint | ✓ | 0 errors | 경고 2개는 기존 `app-t098a-scenes.test.ts`의 안 쓰는 변수 `rule`·`v` (원래 있던 것) |
| npm run build | ✓ | 0 | 라우트: `/demo/seller-dashboard`, `/demo/store/new-product`, `/intro`·`/listing`(308 핸들러), `/lang` |

시험이 보는 것 (`app-t115`): 탭·See all `<a href="#">` + `stay`(preventDefault), aria-disabled 0, 버튼 6개 모두 type=button, 말풍선 span, 사건 줄 3개(서연·지호·마이크)와 숫자 3(배지·3 open·Handle all 3·3 cases)이 같은 `data`에서 (2건이면 2로 바뀜), BF 날 수 = `peakDaysLeft` = `dateLine`, `loadIntroData`에 PayPal 호출 없음(정적) + 데우기는 `after()` 안에서만, peek가 읽기를 시작하지 않음, `/lang` Location이 `https://localhost:10000/lang?...` 요청에서도 상대 경로, 옛 주소 308 + 쿼리 유지, `src/app` 전체에 `NextResponse.redirect`·`new URL(…, request.url)` 없음·`redirect()`는 모두 `/`로 시작, KO 글꼴 순서, 앱 안 `/intro`·`/listing`·`/products` 링크 0 (T114가 지울 products 폴더 제외).

## 남은 문제
1. **`next.config.ts`는 이 worktree에서 Write·Edit 모두 "permission settings에서 막힌 폴더"로 거부됐다.** 그래서 지시서의 "next.config redirects" 대신 `src/app/intro/route.ts`·`src/app/listing/route.ts`(308, 상대 경로, 쿼리 유지)로 했다. 동작은 같다. T114가 `next.config`에 /products 308을 넣으므로 병합 충돌은 없다.
2. 다른 리다이렉트 점검: `applyLangParam`의 `redirect('/lang?…')`, `(app)/cases/[disputeId]`의 `redirect('/?item=…')`는 Next가 주는 값 그대로라 **상대 경로**다. `NextResponse.redirect`는 이제 앱에 없다. 실제 배포 curl 확인은 컨트롤 타워.
3. 0.5초 목표: 클라이언트 `router.prefetch` + 서버 읽기 캐시 데우기(분쟁 목록·상세 GET)를 넣었다. Today의 다른 일(분류·어조 판정·주문 추적 GET)은 데우지 않았다 — 측정에서 모자라면 `warmTodayReads`에 추적 주문 GET이나 `loadDemoDisputes` 전체를 더하는 것이 다음 수다. 데우기는 실제 샌드박스 GET이라 PayPal 서랍에 줄이 남을 수 있다 (Today를 연 것과 같은 읽기).
4. 처음 연 프로세스(캐시가 빈 상태)에서는 기한이 `fallbackDue`(서연 Nov 30, 지호 Nov 29), 마이크는 "Under review · no reply due"로 나온다 (DECISIONS v2.2: 심사 단계, 판매자 응답 기한 없음). Desk가 한 번 읽은 뒤에는 캐시의 실제 값.
5. 사건 줄 글자가 Desk 출처로 바뀌어 KO 화면에서도 상품명은 시드 영어(`Wool Sweater, Navy` 등, Desk와 같음), 구매자는 한글 이름(김서연·박지호), Mike는 `Mike Morgan`. 이전 KO 문구 "울 스웨터"는 없어졌다. 최근 활동 6줄·잔액·매출 막대는 그대로 고정 데모 값(B절 예외).
6. 말풍선 "One buyer mentioned a chargeback" 문장은 고정 문구 그대로다 (건수만 데이터).

## 컨트롤 타워에 요청할 결정
1. `fallbackDue`(캐시가 빌 때의 기한)는 지시서 "연결 표의 고정값"에 맞추려면 `config/demo-links.json`에 기한 칸이 있어야 하는데, 그 파일과 스키마(`_shared/demo-links.ts` zod)는 이번 수정 범위 밖이라 `config/intro.*.json`에 뒀다. 연결 표로 옮길지 결정 부탁 (옮기면 `intro-data.ts` 한 줄).
2. `scripts/ai-cache/build-lib.ts` import 경로 2줄을 고쳤다 (수정 가능 폴더 밖, 폴더 이동 때문에 꼭 필요). 승인 부탁.
3. `next.config.ts` 잠금: 308을 config로 옮기길 원하면 잠금을 풀거나 컨트롤 타워가 옮긴다 (라우트 핸들러 2개 삭제 + redirects 2줄).
4. testing.md·README·Devpost·video-kit·정직성 표의 옛 주소(`/intro`, `/listing`)는 이 지시서 수정 가능 폴더 밖이라 고치지 않았다.
