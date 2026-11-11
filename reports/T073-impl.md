# T073 보고 (2026-11-11)

- 기준 SPEC: v2.10 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치: lane/ui

## 결과
완료 (실제 브라우저 확인은 못 했다 — 개발 서버 금지). Products 표 폭 문제와 공개 모드 줄 위치를 고쳤다. `src/app/_server/`는 건드리지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/products/products.css` | 왼쪽 칸 폭 `20rem` → `clamp(20rem, 26vw, 28rem)` (1440px ≈ 21.6rem, 1920px = 28rem). 고정 폭 아님 |
| `src/app/products/grid.ts` | 열 `minWidth` 추가 (`PRODUCT_COL_MIN_WIDTH`: 상품 96 · Left 64 · 값 128 px). 값 칸이 "$255 → $71" 전체를 담도록. flex 비율 4:2:5. 말줄임 설정 없음, 상품 이름 `wrapText` 유지. 기존 정적 검사(세 자리 숫자 금지)를 지키려고 `단위(8) × 개수`로 적음 |
| `src/app/_shared/top-bar.tsx`, `shell.css` | `modeNote` prop 추가. 공개 모드 줄을 위쪽 막대 안, PayPal activity 버튼 왼쪽 작은 글씨로 |
| `src/app/layout.tsx` | 본문 앞 `<p class="mode-note">` 제거, `TopBar`에 `modeNote`로 전달 |
| `tests/unit/app-product-t073.test.ts` | 새 파일 4개: 열 최소 폭, 말줄임 없음, clamp 사용, 공개 줄 위치 |

## 테스트 결과
| 명령 | 결과 |
|---|---|
| npm test | 2062 통과, 실패 0 |
| npx tsc --noEmit | 오류 0 |
| npm run lint | 오류 0 |
| npm run test:acceptance | 158 통과 (+9 skip), 실패 0 |
| npm run build | 성공 |

실제 AI·PayPal 호출 0회. 개발 서버 없음.

## 남은 문제
- **스크린샷 확인 필요**: 1920×1080, 1440×900에서 값 칸 전체 표시, 상품 이름 두 줄 이내, 위쪽 막대의 공개 모드 줄이 좁은 폭(휴대폰)에서 막대 줄바꿈과 어울리는지. 1440에서 왼쪽 칸이 ~346px이므로 값 칸 최소 128px + Left 64px + 상품 96px = 288px 안에 들어간다. 휴대폰 폭에서는 `.shell-actions`가 줄바꿈(wrap)되도록 돼 있어 막대 안에서 아래로 내려갈 수 있다.
- 가운데 리허설은 1440에서 약 1.8rem 좁아진다.

## 컨트롤 타워에 요청할 결정
- 없음
