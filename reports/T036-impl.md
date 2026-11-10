# T036 보고 (2026-11-10 09:15)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예** — `# SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: `lane/data` / `6019749`

## 결과

**완료.** 서연(B01)의 2026-11-09 문의 1건의 `original`·`english`를 실제 접수한 분쟁 D2의
문장으로 바꿨다. 지시서 본문의 두 문장과 **문자 단위로 같다**(아래 "대조"). `npm run seed`로
`seed/inquiries.json`을 다시 만들었고 바뀐 것은 그 1건의 두 칸뿐이다. AC17 전체 통과, 인수
테스트 실패 0.

단, `npm test`·`npx tsc --noEmit`에 **이 작업과 무관한 기존 환경 문제**가 하나 있다
(`@anthropic-ai/sdk` 미설치, ai 레인 파일만 영향). 아래 "남은 문제" 1번.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `seed/data.ts` | `tableInquiries[0]`(11/09 B01)의 `original`·`english` 교체. 첫 문장은 그대로, 뒤에 세 문장 추가. 다른 필드·다른 문의는 손대지 않음 |
| `seed/inquiries.json` | `npm run seed` 재생성. diff는 **2줄**(`original`, `english`)뿐 |
| `tests/unit/seed.test.ts` | `TABLE_6_3`의 11/09 김서연 기대 문장을 새 문장으로 (72행 근처) |
| `seed/README.md` | "값을 정할 때 쓴 해석" 표에 한 줄 — 왜 늘렸는지(PayPal 120자 요구), 시드가 접수 문장을 따른다는 점, B02·B04 문의는 그대로라는 점 |

`products.json` · `buyers.json` · `disputes.json` · `orders.json`은 **바이트까지 그대로**다.

## 대조 (지시서 1·2항, 문자 단위)

`seed/inquiries.json`의 해당 행을 `tasks/T036.md` 본문 문장과 직접 비교했다.

| 비교 | 결과 |
|---|---|
| 시드 `original` === 지시서 1항 문장 | `true` |
| 시드 `english` === 지시서 2항 문장 | `true` |
| `tests/acceptance/ac17.seed.test.ts`가 시드 `original`을 그대로 담고 있다 | `true` |
| `original` 길이 | 130자 (PayPal이 요구한 120자 이상 충족) |
| 11/09 + B01 문의 건수 | 1건 (대상이 하나임을 확인) |

## 지시서 3항 (그 밖의 값) 확인

`seed/inquiries.json`의 diff가 2줄뿐이라는 사실로 모두 증명된다:
`date`(2026-11-09) · `buyerId`(B01) · `signal`(A2) · `isDemo`(true), 문의 **31건**,
구매자별 건수, **지호(B02)·buyer_m(B04)의 문의** 전부 변화 없음.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 119 (+ skip 9) | **0** | 9개 파일 전부 통과. `ac17.seed.test.ts` 56 tests 통과 — "서연의 대표 문의 원문이 그대로 있다" 개별 실행도 통과 |
| `npm test` | 816 | 0 | 파일 2개가 **로드 실패** (`classify.test.ts`, `llm.test.ts`) — 테스트 실패가 아니라 `@anthropic-ai/sdk` 모듈 해석 실패. `tests/unit/seed.test.ts` 52 tests 통과 |
| `npx tsc --noEmit` | — | 12 errors | 전부 `src/ai/llm.ts`·`tests/unit/llm.test.ts`, 전부 위와 같은 미설치 패키지에서 파생 (`TS2307` + 그 뒤 암시적 any/unknown). `seed/`·`tests/unit/seed.test.ts`에는 오류 0 |
| `npm run lint` | 통과 | 0 | 출력 없음 |
| `npm run seed` 2회 | 동일 | — | 두 번째 실행 후에도 `git diff --stat -- seed/`가 그대로 (결정적) |
| `git diff HEAD~1 HEAD --stat` | — | — | `seed/` 3개 + `tests/unit/seed.test.ts` 1개. **수정 가능 폴더 밖 변경 0** |

## 남은 문제

1. **`@anthropic-ai/sdk`가 이 worktree의 `node_modules`에 없다.** `package.json`(`^1.6.0`)과
   `package-lock.json`에는 들어 있는데 설치만 안 된 상태다. 그래서 `npm test`에서
   `tests/unit/classify.test.ts`·`tests/unit/llm.test.ts`가 로드되지 못하고, `tsc`가
   `src/ai/llm.ts`에서 12개 오류를 낸다. **T036 변경과 무관하고 ai 레인 파일만 영향을 받는다**
   (내가 바꾼 네 파일에는 오류가 없다). 고치려면 worktree에서 `npm install`이 필요한데 이 세션에
   실행 권한이 없어 돌리지 못했다. `package.json`·`package-lock.json`은 **수정하지 않았다**
   (`git status`로 확인).
2. **`main`을 `lane/data`에 병합하지 못했다** (지시서 "의존"). `git merge main`에 실행 권한이
   없었다. 다만 병합이 필요한 이유였던 **AC17의 새 문장 기대는 이미 `lane/data`에 있었고**
   (`git diff main HEAD -- seed/ tests/acceptance/ tests/unit/seed.test.ts`가 빈 결과), main에만
   있는 두 커밋(`febd76a`, `44a8b17`)은 T035(`src/ai/tokens.ts`, `tests/unit/tokens.test.ts`,
   문서)여서 이 작업과 겹치지 않는다. 병합은 컨트롤 타워가 T036을 main에 병합할 때 함께 정리되면
   된다. (참고: `git diff main --stat`을 그대로 보면 T035가 **빠진 것처럼** 보인다. 평가는
   `git diff HEAD~1 HEAD --stat`으로 하는 쪽이 정확하다.)

## 컨트롤 타워에 요청할 결정

- **`tasks/T001.md` 18행이 낡았다.** "D2는 한국어 메시지 그대로"라며 **옛 짧은 문장**을 인용하는데,
  실제 샌드박스 접수는 새 긴 문장으로 했다(그래서 T036이 있다). `tasks/`는 내가 고칠 수 없어
  남겨 둔다. 브라우저 에이전트가 D2를 다시 접수하거나 대조할 때 헷갈릴 수 있으니 새 문장으로
  갱신을 권한다. `tasks/T037.md`는 이미 새 문장을 담고 있다.
- `inbox/2026-11-09-prd-v2.md`(391·563·590·704행)도 옛 문장을 담고 있으나 이쪽은 **원문 기록**이라
  그대로 두는 것이 맞다고 보았다. 별도 조치 불필요.
- 그 밖에 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 할 것은 **없음.**
