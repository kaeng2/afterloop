# T061 보고 (2026-11-10 16:01)

- 기준 SPEC: v2.10   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 코드 커밋: lane/ui / 64664fe (이 보고서는 그 뒤 커밋)

## 결과
일부 완료 — 지시서 본문과 "T060 스크린샷에서 컨트롤 타워가 본 것" 1~4·6번은 구현했다. **5번(Prevent 비율을 엔진 `pickPreventProduct`로)은 남겼다**: T066이 이 브랜치에 아직 없다 (`src/engine/storefront.ts`에 `pickPreventProduct` 없음 확인). 화면 코드의 `pickPrevent`는 그대로다. 실제 AI·PayPal 호출 0회 (테스트는 모두 가짜 호출기), 개발 서버는 띄우지 않았다. 1920×1080 실제 화면은 확인하지 못했다 (스크린샷은 컨트롤 타워 몫).

## 1920×1080 한 프레임에 넣으려고 접은 것 (3줄)
1. 원인 카드·배송사 카드·비교 카드 아래 설명 줄("Engine result … whole dollars")을 없앴다 → 원인은 비교 카드 옆 한 줄 요약, 배송사 기록은 대화 안 한 줄.
2. 답장 칸의 코칭 5줄 · 역번역 · 보조 검사 줄(값 직접 입력·호칭·이름·서명)을 접기(`▸`) 안으로. 영어 초안은 작은 글씨 (구매자 글만 큰 글씨).
3. 대화와 답장 칸을 오른쪽 칸 안에서 좌우 두 칸으로 (오른쪽 칸 폭 60rem 이상일 때, 컨테이너 질의) — 비교 카드 줄 바로 아래에서 답장·보내기 버튼이 시작한다.

## 만든 것 (지시서 절 번호)
1. **머리글**: "Case PP-R-… · Wool Sweater, Navy $72.00 · Waiting for your reply" / "김서연 Seo-yeon Kim · writes in Korean" + 오른쪽 위험 배지(펼침, 그대로). 상태 원래 코드는 첫 줄 `title`. 분쟁 금액은 정확한 금액이라 `toDollarsCents`("$72.00")로 둠.
2. **비교 카드**: 부품 그대로. 전 칸(엔진 수 = 전액 환불일 때만) 아래 "incl. $2 of your time" — `$2`는 `paramsFromConfig().timeCostCents`(가정값, 엔진 `refundLoss`가 쓰는 값)를 `toDollarsRounded`로. Assumption·Demo data 배지 유지.
3. **한 줄 요약**: `summaryOf(전 원인, 후 원인)` → `case.view.summary.A1_A2` ("It's not lost — it's held at Korean customs, waiting for one number."), 문구 없는 전환은 후 원인 이름 키. Code decides 배지 + 보조 글자 "A1 → A2". 원인 카드 삭제. **"Not shipped"**: 문구 파일의 `subtype.A1`·`subtypeShort.A1`을 "No shipping record, or shipped late"·"No shipping record"로 바꿨다 (ko도). 영어 문구 파일 전체에 "not shipped" 0건 (테스트).
4. **대화**: 말풍선(둥근 18px + 한쪽 6px, 옅은 바탕). 원문(lang=ko, 16px) → 영어(lang=en, 12px) + AI suggests. 날짜 순 사이에 "Oct 30 · Carrier: Customs hold – recipient customs ID missing" + Demo data (가장 최근 배송사 기록 1건). 강조 `segmentsOf`: 겹치는 낱말 구간을 합치고(→ "dispute with my card company"), 글자·공백만 있는 3자 이하 틈은 잇는다(→ "카드사에 이의제기"). Show original 토글·배송사 카드 삭제.
5. **답장**: "5 coaching tips ▸" 접기. 본문은 위아래 두 덩이 — "Seo-yeon reads (Korean)" 큰 글씨, "You write (English)" 작은 글씨 (이름은 시드 이름에서 목록과 같은 `buyerShortName`, 대명사 없음). 역번역 접기.
6. **검사**: 보이는 줄 = Facts match · No new promises · Follow-up date 11월 17일 (날짜는 초안에 토큰이 있을 때만, T058 그대로). 나머지는 "More checks ▸". 실패한 줄은 `visibleChecks`로 접기와 상관없이 위에 보이고 굵게.
7. **보내기**: [Send in Korean] / 지호 [Send offer · $7] 그대로.
- **전송 상태 표시**: 답장 칸 맨 위 알약 글자 — 꺼짐 "Simulated send — nothing goes to PayPal", 켜짐+연결 표 허용 "Live · PayPal sandbox", 켜짐+불허 "Live send not allowed for this case — nothing goes to PayPal" (새 키). 모드는 서버(`resolveSendMode` + 연결 표 `liveSendAllowed`)가 정해 넘긴다. 결과 줄 "Sent · send-message 200 · PP-R-…" / "Simulated · nothing was sent". 보내기 성공 → `SentProvider` → 머리글 배지가 "Score 6 → 3"(엔진 `riskAfterReply`)로, Reset이면 되돌아감.
- **연습용**: (가) 두 번째 연습이 막히지 않는 것은 관문의 지금 동작이다 (`executeMove` 기억이 호출기 함수별 → 가짜 기억은 실제와 따로, 같은 답장 재연습 = 기억된 가짜 성공). 코드 변경 없이 테스트로 확인했다. (나) `AFTERLOOP_SIMULATE_FAILURE`는 `src/app/cases/practice.ts` + 서버 액션(`actions.ts`)에서 처리 — **가짜 전송이 관문을 다 통과해 성공했을 때만** 결과를 실패 화면으로 바꾼다. 실제 모드면 변수를 읽지 않는다 (Proxy로 읽기 0회 확인). 문구: paypal_error = 실행 층 문장("The send-message call failed (status code 500).") + "Nothing was sent.", already_replied·not_allowed·checks_failed = 지금의 `case.send.error.*` 키.
- **Today**: 5줄 확인 (테스트). Mike 상세 = 머리글 + "3rd 'not received' claim in 90 days with a delivery record — AfterLoop won't act on this." + Code decides, 답장 칸 없음, AI 초안 안 부름. 문장 키는 `routineLine`(엔진 `decideAutopilot` 판정 + F1·미수령·배송 완료 기록). Mike 목록 배지 → 회색 "Skipped"(`today.skipped`). Autopilot 토글은 `top-bar.tsx`의 `SHOW_AUTOPILOT = false`로 그리지 않음 (코드 유지).
- **T060 스크린샷 1번 화면 폭**: 위쪽 막대 전체 폭, `.main:has(> .today)`로 Today만 가운데 폭 해제. 왼쪽 목록 21.25rem·옅은 바탕·화면 높이 전체(sticky), 오른쪽 흰 바탕이 남은 폭, 상세 내용 최대 80rem(1280px) 왼쪽 정렬.
- **2번 추적 표**: `<table>` 하나로 바꿔 머리·보통·회색 줄이 같은 열을 쓴다.
- **3번**: 위 Skipped. **4번**: `src/app/_shared/nav.tsx` 삭제 (쓰는 곳 0). **6번**: 상수 이름 `UNTRACKED_FIXED_WATCH_BAND` + 주석 "추적 미등록 주문은 엔진 점수가 없어 고정 표시".

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/model.ts` | `timeCost`·`summary`(`summaryOf`)·`carrierLine`·`shortDate`, `segmentsOf` 구간 합치기 |
| `src/app/cases/view/case-view.tsx`·`case.css` | 새 구조 (`CaseHeader`·요약·`case-body` 두 칸) |
| `src/app/cases/view/conversation.tsx` | 말풍선 + 배송사 줄 (`timeline`), 서버 컴포넌트로 |
| `src/app/cases/view/risk-toggle.tsx`·`sent-state.tsx`(새) | 보낸 뒤 배지 값 |
| `src/app/cases/view/load.ts` | `loadCase(id, { draft: false })` (Routine용, LLM 0회) |
| `src/app/cases/reply-model.ts` | `primary`, `visibleChecks`, `sendModeKey`, `liveAllowed` 입력 |
| `src/app/cases/reply/reply-panel.tsx`·`reply.css`·`load.ts` | 접기·두 덩이 본문·모드 글자·결과 줄·`buyerShort`·`liveAllowed` |
| `src/app/cases/practice.ts`(새)·`actions.ts` | 연결 표 허용 여부, 연습용 실패 화면 |
| `src/app/cases/case-detail.tsx`·`routine-detail.tsx`(새) | Routine 갈래 + `SentProvider` |
| `src/app/today/model.ts`·`today-list.tsx`·`today.css`·`tracking-detail.tsx` | `chipKey`·`routineLine`·`decideFor`, 상수 이름, 전체 폭 배치, 표 |
| `src/app/_shared/top-bar.tsx`·`shell.css`, `src/app/_shared/nav.tsx`(삭제) | Autopilot 숨김, 막대 전체 폭 |
| `config/copy.en.json`·`copy.ko.json` | 새 키 19개, 바꾼 값 7개 (+ `version` .3). 두 파일 키 집합 같음 |
| `tests/unit/app-t061.test.ts`(새, 36개) | 완료 기준 전부 |
| `tests/unit/app-case-reply*.test.ts`·`app-case-view.test.ts`·`app-today.test.ts` | 옛 구조(원인 카드·배송사 카드·상태 코드 글씨·`case-stack`·두 낱말 표시) 기대를 새 구조로 |

`src/app/_server/send.ts`·`src/app/page.tsx`·`layout.tsx`·`globals.css`는 **바꾸지 않았다** (수정 가능 폴더 밖. 처음에 send.ts·page.tsx를 고쳤다가 범위 밖임을 확인하고 되돌린 뒤 `cases/` 안으로 옮겼다 — 최종 diff 0줄).

## 완료 기준 대조
| 기준 | 결과 | 테스트 (`app-t061.test.ts` 등) |
|---|---|---|
| 머리글 두 줄, 요약 키 = 엔진 원인 전환, "Not shipped" 없음, "$2" = 가정값 | 예 | 1번·2번·3번 describe |
| 한국어 기본, 영어 밑줄 "dispute with my card company"까지, 배송사 줄 Demo data | 예 | 4번 describe |
| 보이는 검사 3줄, 실패 줄은 접혀도 보임 (가짜 결과) | 예 | 5~6번 describe |
| 모드 글자 꺼짐/켜짐/불허 | 예 | 전송 상태 표시 describe |
| 가짜 두 번 연습 OK, 실제 중복 방지 그대로 | 예 | 연습용 describe (실제 호출 1회) |
| SIMULATE_FAILURE 네 값, 실제 모드 무시 | 예 | 연습용 describe |
| Today 5줄, HEY·GAH 없음, Autopilot 안 보임 | 예 | Today 목록 describe |
| 금액 숫자·Hannah·Fernwood 없음 | 예 | 정적 검사 + 기존 정적 검사 |
| 보내기 관문 테스트(서연·지호) 통과 | 예 | `app-send.test.ts` 변경 없이 통과, send.ts diff 0 |
| 5개 명령 실패 0 | 예 | 아래 표 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 | 0 | 9 skipped (기존과 같음) |
| npm test | 1904 | 0 | 41 파일 (새 `app-t061.test.ts` 36개 포함) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | `.next/static`에 AFTERLOOP_·Hannah·Fernwood·api-m.sandbox 0 파일 |

## 남은 문제
- **T060 5번 미완**: T066(`pickPreventProduct`)이 이 브랜치에 없다. main 병합 후 `today/model.ts`의 `pickPrevent`를 엔진 함수로 바꾸는 작은 후속이 필요하다.
- **한 프레임은 계산 추정이다** (개발 서버 금지라 실제로 못 봤다). 1920 폭이면 오른쪽 칸 ≈ 1580px → 내용 1280px → 대화 ≈ 590 | 답장 ≈ 670px. 세로 예상: 막대 72 + 머리글 ≈ 60 + 비교 줄 ≈ 160 + 답장 칸(모드·접기 2줄·한국어 6~7줄·영어 작은 글씨·검사 3줄·버튼) ≈ 600 → 버튼 아래 끝 ≈ 920px. 초안이 길면 넘칠 수 있다 → 스크린샷에서 넘치면 영어 초안도 접기로 옮기는 것이 다음 수다.
- 1440 폭: 오른쪽 칸 ≈ 1100 − 여백 → 두 칸 기준(60rem=960px)을 넘어 두 칸이 된다. 그 아래 폭은 한 열 (대화 → 답장).
- `:has()`로 Today만 전체 폭을 쓴다 (`globals.css`·`layout.tsx`가 범위 밖이라). 최신 Chrome·Safari는 지원. Products 화면은 아직 가운데 폭이다 (T062 몫).
- 배송사 줄은 가장 최근 기록 1건만 보인다 (Oct 18 Shipped·Oct 21 In transit는 화면에서 빠졌다. 지시서가 요구한 한 줄만).
- 지호 상세: 같은 부품이라 자연히 바뀌었다 (원인 카드 → 요약 "Color difference", 말풍선, 접기). 제안 버튼·관문은 그대로. 지호 실제 화면은 확인 못 했다.
- Mike 상세는 목록 판정과 같은 규칙(`decideFor` + `routineLine`)으로 갈린다. "in 90 days"는 문구 고정값이다 (시드 `disputes90d` 기준과 같은 기간이지만 코드가 계산한 값은 아니다).
- `git rm`·`git checkout`이 권한 대기로 막혀 `rm`과 손 편집으로 처리했다.

## 컨트롤 타워에 요청할 결정
- 없음. (참고: "in 90 days"를 데이터에서 가져오려면 보드에 기간 칸이 필요하다 — 계약 변경이라 이번에는 문구로 두었다.)
