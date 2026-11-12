# T110 보고 (2026-11-12 10:35)

- 기준 SPEC: v2.15 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서 커밋 — `git log -1 lane/ui`)

## 결과
완료. 지시서 1–4번을 CSS(desk.css 3부)와 이번 주 카드 머리 마크업 한 곳으로 고쳤다. 영역 43개는 아래 표에서 모두 "고침 / 예외 / 시안 사본 데이터 사정"으로 분류했다. 동작은 바꾸지 않았다. 개발 서버와 브라우저를 쓰지 않았으므로 **그림으로 다시 확인하지는 못했다**. 아래 "예상 위치"는 round1 PNG에서 잰 px와 CSS 값으로 계산한 것이다. 재비교는 컨트롤 타워 몫이다.

### 원인 (round1 1440 PNG에서 잰 값)
| 구역 | 시안 사본 | 앱(315b601) | 원인 | 고침 |
|---|---|---|---|---|
| 위쪽 막대 높이 | 53px | 59px | 앱에만 있는 EN/한국어 단추(32+3px)가 줄 높이를 정함 → **아래 전체가 6px 밀림** | `body:has(.dk) .shell-actions{margin-block:-4px}`: 단추 크기는 그대로, 줄 높이는 로고(28px) 안으로 |
| 상품 칩·머리글 제목 폭 | 제목 435→828 | 435→848 | 앱 공용 `.num`(tabular-nums)이 제목·메타·칩 부제에도 붙음. 시안은 L130·L144·L208·L748에만 씀 | `.dk .num{normal}`로 끄고 그 4곳만 다시 켬 |
| 머리글→곡선 카드 | 14px (L159 한 section gap) | 18px | 앱은 `.case-page` gap 18 하나 | `.dk .case-head+.curve-card{margin-top:-4px}` |
| 곡선 카드 오른쪽 | "Dispute risk" 카드 위 +63 | +51 | 예외 Assumption 배지가 세로 가운데 맞춤 높이에 들어감 | 배지 `margin-bottom:-20px` (자리 차지 안 함) |
| 이번 주 카드 | 295px | 344px | 제목이 두 줄로 꺾임 + Demo data·AI 알약이 세로로 쌓임 | 제목 nowrap, 오른쪽은 AI 알약 하나(시안 L125). Demo data는 부제 줄 끝(아래 참고) |
| 예외 배지 높이 | 줄 18px | 21px | `.badge` line-height 1.6 + 테두리 | `.dk .badge{line-height:16px}` → 18px. 첫 말풍선 sub 줄, 이번 주 칸이 시안 줄 높이가 됨 |
| 왼쪽 항목 첫 줄 | — | "PP-R-GMS-" / "10197661" 두 줄 | 번호가 꺾임 | 번호 nowrap·shrink 0, 상품명 `flex:1;min-width:0`(… 처리는 시안 L144 그대로) |
| 선택지 카드 | 110px | 108px | `.choice-numbers` line-height 1.35. 시안 L251은 물려받은 1.5 | `.dk .choice-numbers{line-height:1.5}` |

**Demo data 자리:** 1440에서 왼쪽 칸 카드 안쪽 폭은 276px이다. 제목(약 163px) + Demo data(약 82px) + AI 알약(44px) + 간격을 더하면 약 303px라서 한 줄에 들어가지 않는다. 그래서 AI 알약 줄(오른쪽)에는 시안처럼 알약만 두고, Demo data는 왼쪽 부제 "What's on your desk" 뒤에 18px 높이로 붙였다. 머리 높이는 시안과 같은 42px(제목 24px + 부제 18px)이다. 지시서의 "AI 알약 줄에 맞춘다"와 다르게 읽은 것이라면 알려 주면 된다.

**Respond now(지시서 4번):** 카드 안쪽의 상대 위치(머리 +35, 1단계 +47, 카드, 2단계, 편집 칸 286px, 반응 칸 82px, Send 줄)는 앱과 시안 사본이 1–2px 안에서 같았다. 영역 1·5·11·12의 차이는 대부분 **카드 전체가 위로 9px 밀린 것**에서 나온다. 고친 것은 선택지 카드 2px 하나다. 막대(−6)와 간격(−4)을 고치면 앱 Respond now는 시안 사본보다 약 19px 위에 온다. 원인은 Buyer messages 구역이다. 시안 사본은 첫 메시지 아래에 빈 "AI read" 줄(18px + gap 12)을 그리고 앱은 그리지 않는다(NOTES "Could not match" 4번째). 배지 높이를 고쳐서 −5px 차이는 없어졌다. 그러므로 남는 세로 차이는 데이터 사정이다.

## 영역 분류표 (desk-1440, round1 번호)
분류: **고침** = 이번에 고친 것 / **예외** = DECISIONS 결정으로 남김 / **NOTES** = 시안 사본 데이터 사정(`mock-data-NOTES.md`). 고침 행에 남는 차이가 있으면 함께 적었다.

| # | 자리 | 분류 | 근거 |
|---|---|---|---|
| 1 | Respond now 전체 | 고침(막대 −6·간격 −4·선택지 +2) + NOTES | 남는 세로 차이 ≈ 첫 메시지 "AI read" 빈 줄(NOTES). 내부 배치는 시안 값과 같음 |
| 2 | 이번 주 카드 | 고침 | 제목 한 줄·알약 한 줄·배지 높이. Money 칸의 Assumption 줄은 **예외**(22:55 "Assumption 최소")로 남아 1행이 약 20px 높다 |
| 3 | Case history | 고침(위치) | 카드 값은 시안과 같고(②C 27) 막대·간격만 밀렸다 |
| 4 | 둘째 말풍선 | 고침(위치) + 예외 | 카드사 문구 밑줄 = v2.10 ① 결정(NOTES에도 있음) |
| 5 | 한국어 미리보기 | NOTES | 앱은 줄바꿈 유지(pre-line), 사본은 한 문단으로 합침 |
| 6 | Prevent 항목 | NOTES + 고침(위치) | 사본은 "Knit Cardigan · Knit Cardigan"(order·product 고정). 위치는 왼쪽 위 카드 높이를 따름 |
| 7 | 곡선 그림 | 고침(위치) + NOTES | x축 날짜 라벨은 원래 시안도 그리지 않는다(`<text>` 안 sc-interp, 차이 목록 ②B 15). innerText에만 있음 → 앱에서 고칠 일 아님 |
| 8 | 첫 말풍선 | 예외 + NOTES | Demo data 배지(22:55). 사본의 빈 "AI read" 줄(NOTES). 배지 때문에 늘던 +3px는 고침 |
| 9 | Mike 항목 | 고침(위치) | 번호 nowrap. 사본은 꺾여서 높이가 21px 다름 — 지시서 1번대로 앱은 한 줄 |
| 10 | 머리글 제목·메타 | 고침 + NOTES | tabular 숫자 → 제목 20px 좁아짐. 사본 메타 끝 "· Waiting for your reply"는 앱 innerText(화면 읽기 전용 `.case-status`, T107)를 옮긴 것 → NOTES |
| 11 | Send 줄 | 예외 + 고침(위치) | "Simulated send — nothing goes to PayPal" = Simulated 표시 결정 |
| 12 | Refund in full 카드 | NOTES + 고침(2px) | 사본 "expected loss ~$74"는 예전 앱 글. 지금 앱은 시안 DI.en `costShort` "cost ~$74"(T107) |
| 13 | 큰 % 칸 | 고침 | 가운데 맞춤에서 Assumption 배지(예외)를 뺌 → 라벨·%·부제가 시안 자리로. 배지는 그 아래에 남음(예외) |
| 14 | Ji-ho 항목 / Prevent 머리 | 고침(위치) | 왼쪽 위 카드·항목 높이를 따름 |
| 15 | All products 칩 | 고침 | tabular 숫자(칩 부제) + 막대 6px |
| 16 | Buyer messages 부제 | NOTES | 앱 "AI translation below" = 원래 시안 convS. 사본은 예전 앱 글 "translation below" |
| 17 | 로고 | 고침(위치) | 막대 높이 |
| 18 | 기분 칸 라벨 | NOTES | 앱 "Seo-yeon's mood next"(T107: 시안 "{name}'s mood next" 이름 규칙). 사본은 예전 앱 글 "Mood next" |
| 19 | EN/한국어·H 아바타·상호 | 예외 | 앱 전용 막대 요소(NOTES "Documented app-only") |
| 20·23·24·25 | 상품 칩 4개 | 고침 | 막대 6px + tabular 숫자 |
| 21 | Case history 제목 | 고침(위치) | |
| 22 | 곡선 카드 제목 | 고침(위치) | 막대 −6 + 간격 −4 |
| 26 | 상품 요약 "4 products · …" | 고침 | 막대 + tabular 숫자 |
| 27 | "Public demo · simulated sends" · PayPal activity | 예외 | 앱 전용(공개 모드 표시) |
| 28 | 날짜 줄 | 고침(위치) | 막대 높이(글자·값은 시안과 같음) |
| 29·30·34 | 도구 단추 3개 | 고침(위치) + NOTES | 남는 세로 차이 = 1번과 같음 |
| 31·32·33 | 항목 "· 상품명…" | 고침 | 번호가 한 줄이 되어 상품명이 번호 옆에서 …로 줄어듦(지시서 1번). 사본은 시안 L144 그대로라 번호가 꺾이므로 이 자리는 계속 다르게 나온다 |
| 35 | 머리글 상품 타일 | 고침(위치) | |
| 36·37 | 눈금 100%·50% | 예외(의도적 개선) | 차이 목록 ②B 14: 앱은 HTML 글자(늘어나지 않음), 시안은 preserveAspectRatio none으로 늘어난 SVG 글자 |
| 38–43 | 기록 점줄 점 | 고침(위치) | 점 색은 사본이 앱 값을 옮김(NOTES `hist`) |

1920도 같은 원인이다. 번호만 다르다. 1920 15번 "AI translation below"는 위 16번과 같다.

### 예상(계산값, 그림 확인 아님)
- 막대 53px, 상품 줄 53→140: 시안과 같다.
- 오른쪽 머리글·곡선 카드·History: 시안 y와 같다(0±1px).
- Buyer messages 구역: 시안 사본보다 약 25px 짧다(사본의 빈 "AI read" 줄). 그래서 Respond now는 약 19–25px 위에 온다(NOTES).
- 왼쪽: 이번 주 카드는 약 315px(시안 사본 295 + Assumption 줄). Reply needed 항목은 사본보다 21px씩 짧다(번호 한 줄).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/(app)/desk.css` | 3부(T110) 규칙 추가: 막대 여백, `.num` 숫자 폭, 배지 높이, 이번 주 머리, 항목 번호 nowrap, 머리글↔곡선 간격, 곡선 오른쪽 배지, 선택지 숫자 줄 |
| `src/app/today/today-list.tsx` | 이번 주 카드 머리: Demo data를 `.weekly-sub-row`(부제 줄)로 옮김. 오른쪽 `.weekly-head-end`는 AI 알약만. 조건(`usesDemoData`)은 그대로 |
| `tests/unit/app-t110.test.ts` | 새 정적 시험 11개 (머리 마크업·desk.css 규칙·규칙 순서) |

/products 등 다른 화면: 새 규칙은 모두 `.dk` 아래 또는 `body:has(.dk)` 아래다. `WeeklyCard`는 Desk에서만 쓴다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | |
| npm test | 2574 / 2575 (새 시험 11개 포함) | 1 (storefront 결정론 100회, 5초 시간 초과) | 흔들리는 시험. 따로 돌림: `npx vitest run tests/unit/storefront.test.ts` 31/31 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 오류 | 경고 2개는 기존 `tests/unit/app-t098a-scenes.test.ts` (이번 변경 아님) |
| npm run build | 통과 | 0 | |

T102–T107 시험은 바꾸지 않았고 모두 통과했다.

## 남은 문제
- 그림 재비교를 하지 못했다(개발 서버 금지). 특히 확인할 곳은 네 가지다.
  - 막대: 오른쪽 묶음이 −4px 여백으로 로고 줄 안에 들어가는지(PayPal activity 알약 높이가 28px을 넘으면 1–2px 남을 수 있음).
  - 이번 주 카드: 제목 한 줄과 Demo data 부제 줄.
  - 곡선 카드: Assumption 배지가 아래 글자와 겹치지 않는지(배지는 from-to 줄 아래 2px).
  - 항목: "PP-R-GMS-10197661 · Wool Swe…"가 한 줄로 나오는지.
- 이번 주 Money 칸의 Assumption 배지 줄(예외)이 1행을 약 20px 높인다. 칸 폭(110px) 안에는 "case" 뒤에 배지가 들어갈 자리가 없어 그대로 두었다.
- 시안 사본 자체를 고치면 NOTES 행(16·18·12의 예전 앱 글, 첫 메시지 "AI read" 빈 줄)이 비교에서 빠진다. 이것은 컨트롤 타워 쪽 일이다.

## 컨트롤 타워에 요청할 결정
- 없음. (Demo data 자리를 "부제 줄 끝"으로 읽은 것만 확인해 달라 — 위 "Demo data 자리")
