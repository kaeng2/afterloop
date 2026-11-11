# T062 보고 (2026-11-11 19:20)

- 기준 SPEC: v2.10 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / a062186 (구현). 이 보고서는 다음 커밋

## 결과
완료. `/products`의 최소판(상품 카드 4개)을 세 칸으로 바꿨다: 왼쪽 상품 목록 · 가운데 리허설(큰 숫자 + 범위 문장 + 점 그림) · 오른쪽 처방 카드 4개. 모양은 지금 공용 틀(변수·카드·배지) 그대로이고 꾸미기는 하지 않았다 (11/11 사람 결정). 단, **카드의 "could save $X"는 빼기 없이 두 엔진 값을 나란히 적는 꼴로 바꿨다** (아래 "컨트롤 타워에 요청할 결정" 1).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/products/model.ts` | 새 파일. 보기용 순수 함수: `buildProductView`(큰 숫자·범위·카드), `buildDotPlot`(`pickRepresentativeFuture` 그대로), `buildProductRows`(왼쪽 목록 행 — **T065가 AG Grid 행으로 그대로 쓴다**, `simulateStore` 순서), `defaultSku`/`selectSku`(기본 = Today Prevent 상품 `pickPreventProduct`), `transactionLineView`, `colorComplaintsFor`, `colorNoteView`, `toggleFix`/`orderedFixes`. DOM·네트워크·시계·난수 없음 |
| `src/app/products/products-screen.tsx` | 새 파일 (`'use client'`). 토글 상태를 들고 `model.ts`를 브라우저에서 다시 부른다 (서버 왕복 없음). 기본 = 처방 4개 켬 |
| `src/app/products/views.tsx` | 새 파일. 상태 없는 그리기 부품: `ProductList`, `Rehearsal`, `DotPlot`, `FixCards`, `FixCard`, `FixBadge` |
| `src/app/products/color-note-card.tsx` | 새 파일 (`'use client'`). [Write the note] → 서버 액션. 한국어 한 줄 크게 + 나머지 언어·역번역 `<details>`. 실패면 자리 전체를 숨김 (기본 문구 없음) |
| `src/app/products/color-note.ts` | 새 파일 (`server-only`). `colorNoteFor(sku, llm)` → `writeColorNote` |
| `src/app/products/actions.ts` | 새 파일 (`'use server'`). `writeColorNoteAction(sku)` — `getLlm()`(읽기만) + `colorNoteFor` |
| `src/app/products/transactions-line.ts` | 새 파일 (`server-only`). `loadTransactionLine` → `getTransactions(client, lastDays(now, 30), 프로세스 메모리 캐시)`. 실패하면 null(줄 숨김). `_server/`는 고치지 않았다 (T070과 겹침) |
| `src/app/products/page.tsx` | 최소판 → 세 칸. `?sku=` 읽기, 거래 조회 한 줄, 색상 문구 대상 상품 결정 |
| `src/app/products/products.css` | 세 칸 배치(64rem 아래 한 열), 점 그림(빨강 = `--color-danger`), 처방 카드, Simulated 배지(2px 점선 + 굵은 글자) |
| `config/copy.en.json`, `config/copy.ko.json` | `product.*` 키 42개 추가 (두 파일 같은 키). 기존 키는 바꾸지 않았다 (`shell.products.*` 3개는 이제 쓰이지 않지만 `product.` 밖이라 그대로 둠) |
| `tests/unit/app-product.test.ts` | 새 파일. 32개 |

## 화면 값 (라이브 `config/params.json`, 가디건 `FK-CD-OAT`, 엔진이 낸 값 — 코드·문구에 적지 않았다)
| 항목 | 처방 0개 | 처방 4개 |
|---|---|---|
| 큰 숫자 | `$216` 하나 + "Turn on a fix to see it change." | `$216` → `$44` |
| 범위 문장 | Sell as-is: about 4.5 disputes, $216 (likely $67–$360). | + With these fixes: about 2.1 disputes, $44 (likely $0–$104). |
| 점 그림 빨간 점 (전 → 후) | 4 (후 그림 없음) | 4 → 2 |
| 카드 값 (tracking / color / customs / settle) | Turn on: $216 → $170 / $150 / $197 / $138 | On. If off: $44 → $90 / $72 / $55 / $88 |

왼쪽 목록 (처방 4개, `simulateStore` 순서): Beanie + Scarf Set `$255 → $71` · Knit Cardigan `$216 → $44` · Cashmere Coat `$137 → $113` · Wool Sweater `$110 → $26`. 기본 상품 = 가디건 (Today Prevent와 같다).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 (+ 9 skip) | 0 | 실행만 했다 |
| npm test | 2004 | 0 | `app-product.test.ts` 32 |
| npx tsc --noEmit | — | 0 | |
| npm run lint | — | 0 | |
| npm run build | — | 0 | `/products` 25 kB |

실제 AI·PayPal 호출 0회 (가짜 LLM·가짜 `PayPalClient`·미리 채운 캐시만). 개발 서버를 띄우지 않았다.

## 완료 기준 대조
| 기준 | 결과 | 근거 |
|---|---|---|
| 큰 숫자·범위·분쟁 수 = `simulate` 결과의 달러 반올림 (처방 0개 / 4개) | 통과 | `buildProductView` 테스트 2개 + 16가지 조합 + 가정값 사본 변경 |
| 빨간 점 수 = `pickRepresentativeFuture` 전·후 (지금 4 → 2) | 통과 | 고정 사본·라이브 config 둘 다, 그려진 HTML의 `data-red` 수까지 셈. 후 ⊆ 전 |
| 처방 카드 4개, 통관 안내 "Simulated" 배지, 색상 문구 실패 시 자리 없음 | 통과 | `FixCards` 렌더 테스트, `colorNoteView` 실패 → null, 슬롯 null이면 `color-note` 마크업 없음 |
| 폭포·분포 막대·전후 막대 없음 | 통과 | 렌더·소스에 `waterfall`/`histogram` 없음 |
| 토글 → 재계산 0.5초 안 | 통과 | 16조합 × (가운데 + 카드 4개 + 왼쪽 4행) 1회 최악 **77.7ms**, 평균 54.2ms (node, 이 맥). 브라우저에서 그대로 돈다 (서버 왕복 없음) |
| 왼쪽 목록 행에 as-is와 with fixes 함께 | 통과 | `buildProductRows` 테스트 (`simulateStore`와 값·순서 같음) |
| 화면 코드에 금액·건수 숫자 없음 (정적 검사) | 통과 | `src/app/products/*.ts(x)`에 `$숫자`·세 자리 이상 정수·소수·`/100`·`toFixed`·`Math.round` 없음. `product.*` 문구에 `$숫자`·"N disputes" 꼴·금지 문구 없음 |
| 명령 5개 실패 0 | 통과 | 위 표 |

## 처방을 하나씩 켜며 볼 순서 (스크린샷용)
1. `/products` (기본 가디건, 처방 4개 켬) — `$216 → $44`, 점 4 → 2
2. 카드 4개 모두 끔 — `$216` 하나 + "Turn on a fix to see it change.", 점 그림 하나, "Turn all on" 보임
3. tracking → color note → customs → settle 순서로 켬 — 큰 숫자·범위·점·왼쪽 가디건 행이 함께 바뀜
4. 색상 문구 카드의 [Write the note] (LLM 키가 있을 때만 실제 호출. 없으면 누르면 자리가 사라진다)
5. 왼쪽에서 코트 선택 — 처방 후 P90이 커지는 것이 그대로 보임 (`?sku=FK-CT-GR`)

## 남은 문제
- 색상 문구 구매자 글: 시드 문의에는 SKU가 없어서 "이 상품에 색상(B1) 분쟁 이력이 있으면 시드 B1 문의 원문 전부"로 정했다 (지금은 가디건만 해당). 지호 분쟁 글(실제 PayPal)은 넣지 않았다 — 이 화면에서 분쟁을 읽지 않으려고.
- 색상 문구는 버튼을 눌러야 쓴다 (T020 보고서 "S2 서버 액션이 [Write the note]에서"). 결과를 캐시하지 않는다 — 다시 누르면 다시 묻는다.
- 처방 토글 상태는 주소에 두지 않았다 (상품을 바꿔도 유지, 새로 고치면 4개 켬으로 돌아감).
- 분쟁 수 표기는 소수 첫째 자리 (`Intl.NumberFormat`, 표기만).
- 거래 조회 한 줄: `.env`가 없으면 숨김. 서버가 다시 뜨면 캐시가 빈다 (T019 설계). 녹화 전 캐시 데우기는 T025 몫.
- 화면은 DOM 시험 도구가 없어 `renderToStaticMarkup`으로만 확인했다. 토글 클릭 동작은 실제 브라우저에서 컨트롤 타워가 확인해야 한다.

## 컨트롤 타워에 요청할 결정
1. **처방 카드의 "could save $X"**: 지시서는 "엔진: 그 처방 하나를 지금 상태에 더했을 때 줄어드는 금액, 또는 엔진이 주는 처방별 절감"이라고 했지만, 엔진에는 처방별 절감 함수가 없고, 화면이 두 엔진 값을 빼면 "화면은 계산하지 않는다"(지시서 규칙 1, CLAUDE.md, AC23 초안 결정 "절감액·감소 비율은 화면에 적지 않는다")에 어긋난다. 그래서 **두 엔진 값을 나란히** 적었다: 꺼진 카드 "Turn on: $216 → $170", 켜진 카드 "On. If off: $44 → $90" (둘 다 `simulate(...).after.meanLossCents`). "could save $46"처럼 차이 하나로 보이려면 engine 레인에 `fixSavings(sku, product, fixesOn)` 같은 함수를 내 주면 화면은 옮기기만 하면 된다 (문구 키 `product.fix.effect.*` 두 개만 바뀐다).
2. 쓰이지 않게 된 `shell.products.title`·`shell.products.stockLeft`·`shell.products.listLabel` 문구 키를 지울지 (`product.` 밖이라 이 작업에서는 그대로 두었다).
