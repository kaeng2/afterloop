# T072 보고 (2026-11-11)

- 기준 SPEC: v2.10 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 구현 커밋 (이 보고서와 같은 커밋)

## 결과
완료. ① 처방 토글 처음 상태 = 모두 꺼짐 (`useState([])`). ② 처방 카드 숫자 = 엔진 `fixSavings(input).savingCents`를 달러 반올림해 옮긴 한 숫자. 꺼진 카드 "could save $X", 켜진 카드 "saving $X". 화면은 빼지 않는다. 왼쪽 AG Grid 표·깜빡임 코드는 건드리지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/products/model.ts` | `buildProductView`가 `fixSavings(input, config, rules)`를 한 번 부르고 카드별 `effect = { saving, text }`로 옮긴다. 처방마다 `simulate`를 다시 부르던 `meanWith`와 `from/to` 두 값 제거 |
| `src/app/products/products-screen.tsx` | 처방 상태 처음 값 `[]` (상품을 바꿔도 지금 상태 유지는 그대로) |
| `src/app/products/views.tsx` | 카드 `data-from/data-to` → `data-saving` |
| `config/copy.en.json`, `config/copy.ko.json` | `product.fix.effect.off` = "could save {{saving}}" / "켜면 {{saving}} 절감 가능", `product.fix.effect.on` = "saving {{saving}}" / "{{saving}} 절감 중" |
| `tests/unit/app-product.test.ts` | 카드 테스트를 `fixSavings` 기준으로 교체, 처음 상태·4개 켬·16조합·정적 검사 추가 (32 → 37개) |

## 화면 값 (라이브 `config/params.json`, 가디건, 엔진이 낸 값)
| 상태 | 카드 4개 (tracking / color / customs / settle) |
|---|---|
| 처음 (처방 0개) | could save $46 / $66 / $19 / $79 — 큰 숫자 $216 하나 + "Turn on a fix to see it change." |
| 4개 켬 | saving $46 / $28 / $11 / $45 |

지시서의 기대 값과 같다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 (+ 9 skip) | 0 | 실행만 했다 |
| npm test | 2025 | 1 → 0 | `storefront.test.ts` "같은 입력 100회"가 시간 초과로 1번 실패 (T065 보고와 같은 기계 부하 현상, 엔진 안 건드림). 단독 재실행 31개 모두 통과 |
| npx tsc --noEmit | — | 0 | |
| npm run lint | — | 0 | |
| npm run build | — | 0 | `/products` 268 kB |

실제 AI·PayPal 호출 0회. 개발 서버를 띄우지 않았다. `src/app/_server/` 안 고침.

## 완료 기준 대조
| 기준 | 결과 | 근거 |
|---|---|---|
| 처음 상태: 켠 처방 0개, 큰 숫자 = as-is, 카드 4개 = `fixSavings` 0개 결과 | 통과 | 테스트 "처음 상태", 화면 소스 `useState<FixId[]>([])` 검사, 위 표 |
| 4개 켬: 카드 = `fixSavings` 4개 결과, 켜짐 꼴 | 통과 | 테스트 "처방 4개 모두 켜면", 16조합 테스트 |
| 화면 코드에 금액 숫자 없음, 빼기 없음 | 통과 | 기존 정적 검사 통과 + `model.ts` 빼기 패턴 없음 검사 추가 |
| 표 With fixes 값·깜빡임 그대로 | 통과 | `app-product-grid` 14개 통과, 해당 코드 안 바꿈 |

## 남은 문제
- "Turn all on" 버튼은 처음 상태에서 항상 보인다 (영상 흐름 "켜서 $44"에 쓸 수 있음). 이 버튼이 4개를 한 번에 켜서 표 깜빡임이 동시에 일어나는 것은 실제 브라우저에서 확인 필요.
- 첫 줄 "처음 상태"는 서버 렌더와 같은 값이라 깜빡임·불일치 없음. 단 실제 브라우저 확인(토글 클릭)은 이전과 같이 컨트롤 타워가 해야 한다.
- 쓰이지 않는 문구 키 정리 요청(T062 보고 2번)은 여전히 열려 있음.

## 컨트롤 타워에 요청할 결정
- 없음
