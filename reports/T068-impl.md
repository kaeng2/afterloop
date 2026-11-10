# T068 보고 (2026-11-10 16:40)

- 기준 SPEC: v2.10   (시작할 때 SPEC.md 첫 줄 `SPEC v2.10`과 같았는지: 예)
- 브랜치 / 마지막 코드 커밋: lane/ui / 572c40e (이 보고서는 그 뒤 커밋)

## 결과
완료. 서연·지호 상세를 한 열(머리글 → 가로 전체 폭 비교 카드 + 카드 안 한 줄 요약 → 대화 → 칩 줄 → 답장 좌우 두 칸 → 검사 줄 + 보내기)로 바꿨다. T069가 이 브랜치에 없어서 칩은 지시서 "칩" 절대로 `replyChips(draft)`(`chips`가 있으면 그것, 없으면 코칭 줄 그대로)로 했다. 실제 AI·PayPal 호출 0회(테스트는 가짜 호출기만 썼다). 개발 서버는 띄우지 않았다. 1920×1080 실제 화면은 보지 못했다 (스크린샷은 컨트롤 타워 몫).

## 1920×1080 한 화면에 넣으려고 줄인 것 (3줄)
1. 회색 요약 상자를 없애고 요약 한 줄을 비교 카드 안 맨 아래로 옮겼다. 상세에서는 카드 안쪽 여백을 12/16px로 줄였다.
2. 코칭 접기 대신 칩 한 줄을 넣었다. 답장 칸은 카드 테두리를 없애고 위쪽 선 하나만 두었다. 제목 "Reply"와 "Checks before sending"은 화면 읽기 전용 글자로만 남겼다.
3. 검사 줄·전송 모드 글자·보내기 버튼을 맨 아래 한 줄에 모았다. 상세 세로 간격을 16px에서 12px로 줄였다.

## 만든 것 (지시서 절 번호)
1. **머리글**: `productShortName`(시드 상품 이름의 쉼표 앞) + 분쟁 금액 `toDollarsRounded` → "Case PP-R-… · Wool Sweater $72 · Waiting for your reply". 화면 코드에 72가 없다 (테스트). 위험 배지는 그대로다.
2. **비교 카드**: 상세에서만 `.case-hero .cc-card { width: auto }`로 가로 전체 폭이다 (숫자 격자는 내용 폭 그대로, 공용 부품은 고치지 않았다). 카드의 `footer` 자리(위쪽 선)에 한 줄 요약 + Code decides + "A1 → A2"를 넣었다. Assumption 배지와 오른쪽 칸 Demo data, "incl. $2 of your time"은 그대로다. `<section class="case-summary">` 상자는 없다.
3. **대화**: 바꾸지 않았다 (말풍선은 `align-self: flex-start` + 최대 92%라 이미 내용 폭이다). 대화와 답장을 나누던 두 칸 격자와 `@container`를 없애 늘 한 열이다.
4. **칩 줄**: "Suggested reply covers:" + 알약 칩(`--color-pill-neutral-*`, 시안 `c-grey`와 같은 값) + AI suggests. 칩 토큰은 영어 초안과 같은 길(`screenText`, 영어 사실값 벌)로 채운다. 빈 배열이면 줄을 숨긴다. "5 coaching tips ▸" 접기는 없앴다.
5. **답장 두 칸**: `grid repeat(2, 1fr)`. 왼쪽은 "You write (English)", 오른쪽은 "Seo-yeon reads (Korean)"(이름은 `buyerShort` 데이터, 대명사 없음)이고 둘 다 AI suggests. 두 칸 글자는 규칙 하나 `.reply-english, .reply-outgoing { font-size: var(--reply-text-size) }`이고 `--reply-text-size: var(--text-md)`(본문 16px)다. 역번역은 두 칸 아래 "Back-translation ▸" 접기다. 40rem 아래 폭에서는 위아래로 쌓는다.
6. **맨 아래 한 줄**: 왼쪽에 ✓ Facts match · ✓ No new promises · Follow-up date 11월 17일, Code decides, "More checks ▸"를 둔다. 실패한 검사는 `visibleChecks` 그대로 이 줄에 보인다. 오른쪽 끝에는 모드 작은 글씨("Simulated send — nothing goes to PayPal" / "Live · PayPal sandbox" / 불허 문구)와 [Send in Korean]을 둔다.
- **지호**: 같은 틀이다. 오른쪽 끝에 [Send offer · $7](강조) → [Send in Korean](조용, 꺼짐) + 지금의 꺼짐 이유를 둔다. 비교 카드는 전 칸만(지금 꼴), 한 줄 요약은 지금 지호 문구다.
- **Mike**: 지금 그대로다. `routine-detail.tsx`는 고치지 않았다. 옅은 바탕 상자 꼴은 `.case-summary`에서 `.case-routine` 규칙으로 옮겨 같은 모양을 유지했다.
- 보내기 관문(`src/app/_server/send.ts`)과 서버 액션은 고치지 않았다 (diff 0).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/model.ts` | `productShortName`, 머리글 금액을 달러 반올림으로 (`toDollarsCents` import 제거) |
| `src/app/cases/reply-model.ts` | `replyChips(draft)`, `ReplyView.chips` (토큰 채움) |
| `src/app/cases/view/case-view.tsx`·`case.css` | 한 열, 요약을 비교 카드 `footer`로, 두 칸 격자·컨테이너 질의 삭제, `.case-routine` |
| `src/app/cases/reply/reply-panel.tsx`·`reply.css` | 칩 줄, 좌우 두 칸, 맨 아래 한 줄(검사 / 모드 + 버튼), 카드 테두리 → 위쪽 선, 코칭 접기 삭제 |
| `config/copy.en.json`·`copy.ko.json` | `case.reply.covers` 추가 (두 파일 같은 키). `version`은 고치지 않았다 (`case.` 키가 아니라서) |
| `tests/unit/app-t068.test.ts` (새 파일, 23개) | 완료 기준 전부 |
| `tests/unit/app-t061.test.ts`, `app-case-reply.test.ts`, `app-case-reply-retry.test.ts`, `app-case-view.test.ts` | 옛 배치를 기대하던 6곳: 머리글 꼴/금액("$72.00" → "$72", 상품 쉼표 앞), 요약 `section` → `div`, 두 칸 컨테이너 질의 → 늘 한 열, 코칭 접기 → 없음 + 영어가 왼쪽(먼저), 모드 글자 "맨 위" → "버튼 옆" |

## 완료 기준 대조
| 기준 | 결과 | 테스트 (`app-t068.test.ts`) |
|---|---|---|
| 한 열, 회색 요약 상자 없음, 요약이 비교 카드 안, 두 칸 나란히, 글자 크기 변수 같음, 모드 글자가 버튼 옆 | 예 | "배치" describe (순서·카드 안·css 규칙·버튼 옆) |
| `replyChips`: chips 우선 / 없으면 코칭 / 토큰 채움 / 빈 배열이면 숨김 | 예 | "칩" describe |
| 머리글 "Case … · Wool Sweater $72 · Waiting for your reply" (화면 코드에 72 없음) | 예 | "1번" describe + T061 정적 검사 |
| 출처 배지 4종 | 예 | "출처 배지 4종" |
| 보내기 관문·지호 제안 테스트 | 예 | `app-send.test.ts`, `app-case-reply-retry.test.ts` 고치지 않은 채 통과 + "지호 꼴" |
| 5개 명령 실패 0 | 예 | 아래 표 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 | 0 | 9 skipped (기존과 같다) |
| npm test | 1957 (43 파일) | 0 | 새 `app-t068` 23개 포함 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |

## 남은 문제
- **한 화면은 계산으로 추정한 것이다** (개발 서버 금지). 1920 폭, 상세 최대 1280px 기준: 막대 72 + 여백 24 + 머리글 ≈ 60 + 비교 카드(요약 포함) ≈ 190 + 대화(배송사 줄 + 말풍선 2개) ≈ 300 + 답장(칩 28 + 두 칸 ≈ 140 + 역번역 24 + 아래 줄 36) ≈ 260 + 간격으로 버튼 아래 끝은 약 940px로 본다. 초안이 길거나 말풍선이 3개면 넘칠 수 있다. 넘치면 다음 수는 대화 제목 줄 삭제나 말풍선 영어 줄 간격 줄이기다.
- **칩 날짜 표기**: 영어 날짜 표기 함수(`formatFact`, ai 레인)는 "November 17"을 낸다. 화면은 그 값을 옮기기만 하므로 칩은 "Follow-up: November 17"로 보인다. 지시서 예시 "Nov 17"과 다르다. 짧게 하려면 T069 칩 글자나 ai 레인 표기에서 정해야 한다 (화면에서 줄이지 않았다).
- T069 병합 전에는 칩이 코칭 줄 그대로라 길다 (지시서대로). 병합되면 `draft.chips`가 생기면서 짧은 칩으로 자동으로 바뀐다. `ReplyDraft` 타입에 `chips`가 아직 없어서 `replyChips`는 `chips`를 `unknown`으로 읽고 문자열 배열일 때만 쓴다.
- 환불 칩: 화면이 칩을 거르지 않는다. 코칭 대체 경로에서는 T053이 `fight` 수의 환불 코칭 줄을 이미 버린다. T069 경로에서는 T069 검사가 막는다.
- `case.reply.coachingToggle` 키는 쓰지 않게 됐지만 문구 파일에 남겼다 (지워도 된다).

## 컨트롤 타워에 요청할 결정
- 없음. (참고: 칩 날짜를 "Nov 17"처럼 짧게 하려면 ai 레인 `formatFact` 또는 T069 칩 규칙에서 정해야 한다.)
