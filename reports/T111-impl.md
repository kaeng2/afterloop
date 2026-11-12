# T111 구현 보고 — /listing 1–2px 세로 어긋남

기준 SPEC v2.15. 모델 sonnet-5-5. 수정 파일: `src/app/listing/listing.css`만 (3줄).

## 원인
시안 머리 높이 = 66px, 앱 = 64px (시안 1115 / 앱 1113, 차이 2px와 일치).
검색창 `<input>`이 시안에서는 브라우저 기본 padding(1px 2px)을 가진다. 앱은 `globals.css`의 `*{padding:0}` 때문에 이 padding이 0이라 입력줄이 23px → 21px, 검색 칸(9+9 padding)이 41px → 39px, 머리가 2px 낮아졌다. 머리 아래 전부가 2px 위로 밀려 글자 가장자리가 거의 모든 곳에서 빨갛게 나왔다. (`.fld`·`.btn`·`.snav`·`.ins`는 시안이 padding을 직접 정하므로 영향 없음.)

## 고친 것
1. `.ls-search input{padding:1px 2px}` — 시안의 브라우저 기본값을 되살림. 머리 66px, 아래 전체 +2px.
2. `.ls-side > .snav:last-child{padding-left:40px}` — 사이드 메뉴 "PayPal payments" 글 시작 x를 시안(아이콘 20px + gap 10px 뒤)과 같게. 아이콘은 계속 없음(예외 E7). 마크업을 안 바꿔 `app-t087-listing.test.ts`의 문자열 시험 그대로 통과.

## 영역별 분류표 (1440 regions.json 기준)
| 영역 | 내용 | 분류 |
|---|---|---|
| 10, 16, 28 | 머리: 가게 이름·검색·아바타 | 고침(1) — 머리 높이 |
| 21, 14, 13, 20, 26, 18 | 사이드 메뉴 항목들 | 고침(1) — 아래로 2px 밀림이 원인 |
| 19 | "PayPal payments" 겹침 | 고침(2) 글 위치. 아이콘 "P" 없음은 **예외**(DECISIONS 11/11 22:55, PayPal 로고 없음) |
| 15 | 빵부스러기 | 고침(1) |
| 24, 23, 29, 7, 5, 8, 2, 11, 27, 25 | 사진 칸·Add photo | 고침(1) — 2px 밀림. 사진 안 픽셀 차이는 시안 사본 이미지와 앱 이미지 리샘플링 차이 가능 → 재비교 후 남으면 "데이터 사정" |
| 3, 4, 1, 6 | 입력·날짜·textarea | 고침(1) — 2px 밀림 (textarea 안 글자 차이는 같은 원인) |
| 17 | "Includes Black Friday week" 칩 | 고침(1) |
| 22, 9 | Save draft / Publish | 고침(1) |
| 12 | DisputeLess API 줄 | 고침(1) |
| 앱 Demo 띠 `.ls-band` | 시안에 없음 | **예외** (Simulated 표시, 비교 때 숨김) |
| Fernwood Knits·FK | 시안 사본 데이터 | **시안 사본 데이터 사정** (mock-data-NOTES) |

## 확인 못 한 것
이 세션에서 Python·개발 서버를 쓸 수 없어 PNG 픽셀을 직접 재지 못했다. 원인은 시안 마크업·CSS와 앱 CSS를 줄 단위로 대조해 찾았고(차이 2px가 수치로 맞음), 재비교는 컨트롤 타워가 한다. 재비교 후 남는 1px 차이가 있으면 textarea `field-sizing` 줄 높이를 다음에 본다.

## 시험
- `npx tsc --noEmit`: 통과
- `npm run lint`: 오류 0 (경고 2, 기존)
- `npm run test:acceptance`: 15 파일 통과 (177 통과 / 9 skipped)
- `npm run build`: 통과
- `npm test`: 2557/2558. 실패 1건은 시간 제한 흔들리는 시험 (`sim.test.ts` 50ms 한도 51.2ms, `storefront.test.ts` 100회 5초 제한 — 실행마다 둘 중 하나). `tests/unit/sim` 단독 실행은 41/41 통과. 이번 변경은 CSS뿐이라 무관.

## 컨트롤 타워에 요청할 결정
없음.
