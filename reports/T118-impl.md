# T118 보고 (2026-11-12 14:50)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서와 같은 커밋)

## 결과
완료. 3개 모두 고쳤고 시험을 붙였다. 동작·관문·Simulated·엔진 계산은 바꾸지 않았다. 브라우저 확인(1280·1440·1920)은 컨트롤 타워 몫이다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/reply/reply.css` | ① 시안 L58 아래 여백 46px을 나눔: `.reply-editor-field` padding-bottom 40px(스크롤 안 되는 칸, 바탕 흰색) + `.reply-textarea` padding 14/16/**6**px. 합은 46px 그대로라 칸 높이와 모양은 같다 |
| `src/app/cases/routine-detail.tsx` | ② Mike 상태 문장 뒤에 기존 `<Badge kind="demo" />` (Today 상세 카드와 사례 주소 화면 둘 다) |
| `src/app/cases/view/work-zone.tsx` | ③ `head` prop 추가. Send 뒤(`sent`)에는 머리를 그리지 않는다. `children`은 선택 prop으로 바꿈 |
| `src/app/cases/view/case-view.tsx` | ③ "Respond now" 머리(AI 알약 + 제목 + 부제)를 `WorkZone`의 `head`로 넘김 |
| `tests/unit/app-t118.test.ts` | 새 시험 7개 (①의 여백 합·알약 위치, ② 배지 렌더, ③ Send 전/후 렌더) |
| `tests/unit/app-t116.test.ts` | `<WorkZone titleId=…` 정규식을 여러 줄 형식에 맞게 바꾸고, lint `react/no-children-prop` 오류(이전부터 있던 것) 고침 |

### ① 원인과 고친 방법
알약은 `position:absolute; bottom:12px`로 글자 칸 오른쪽 아래에 있고, 글자 칸 안쪽 여백 46px이 그 자리를 비워 두었다. 그런데 textarea 안쪽 여백은 **스크롤 영역 안**이라서, 글이 5줄을 넘으면 스크롤되는 줄이 그 여백 위로 지나가 알약 밑에 깔렸다 (1920 폭은 두 칸 배치라 칸이 좁아 줄이 많다). 여백 대부분(40px)을 스크롤되지 않는 바깥 칸으로 옮겼다.
알약 위 끝 = bottom 12 + padding 4 + 13px × 1.5(`.dk` 줄 높이를 물려받음) + 4 = 39.5px < 40px. 그래서 폭과 관계없이(1280·1440·1920) 글자가 알약 밑으로 가지 않는다. 시안 값(L58 padding 14/16/46, L840 right 12 · bottom 12 · padding 4/12 · 13px 900)은 그대로 썼다.

### ② 배지
상태 문장은 코드 판정이라 AI 알약은 그대로 없다(`ai={false}`, T106 시험 유지). 문장 속 사실(이전 미수령 분쟁 수, 배송 기록)이 시드 데이터라서 Demo data 배지만 붙였다. Routine 화면은 Mike만 쓰므로 `case.routine.other` 문장에도 같은 배지가 붙는다 (역시 시드 값에서 나온 판정).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 건너뜀) | 0 | |
| npm test | 2603 | 1 | `storefront.test.ts` "같은 입력 100회" 시간 초과 (전체 실행 부하). 단독 실행하면 31/31 통과 — 지시서가 말한 storefront 흔들림 |
| npx tsc --noEmit | ✓ | 0 | |
| npm run lint | ✓ | 0 오류 | 경고 2개는 `app-t098a-scenes.test.ts`의 이전 것 |
| npm run build | ✓ | 0 | |

실제 AI·PayPal 호출, 개발 서버, `.env` 읽기 없음. `_server/send.ts`·`mode.ts`·`activity.ts` 무변경.

## 남은 문제
- 브라우저 확인(1280·1440·1920에서 긴 답장 스크롤, Mike 화면 배지, Send 뒤 머리 없음)은 컨트롤 타워가 한다.

## 컨트롤 타워에 요청할 결정
- 없음

## 재시도(회귀 수정)
- 원인: `WorkZone`이 Send 전 `<section>{head}{children}</section>`, Send 뒤 `<section>{children}</section>`로 두 갈래를 그려 children의 트리 위치가 바뀌었다. Send 순간 답장 칸(ReplyPanel)이 새로 마운트되어 보낸 결과·진행 칸 상태가 사라지고 AI 초안으로 돌아갔다.
- 고침 (`src/app/cases/view/work-zone.tsx`): `<section>` 하나 안에 항상 `{sent ? null : head}` 다음 `{children}`을 같은 자리에 둔다. section의 `aria-label`/`aria-labelledby`만 `sent`에 따라 바꾼다. 렌더 결과 HTML은 이전과 같다.
- 시험 (`tests/unit/app-t118.test.ts`): "두 상태 모두 children이 같은 자리" 정적 시험 추가 (section 1개, `{sent ? null : head}{children}` 순서, 두 갈래 JSX 없음).
- 실제 AI·PayPal 호출, 개발 서버, `.env` 읽기 없음. 브라우저 재확인(Send 뒤 "What happens next")은 컨트롤 타워가 한다.
