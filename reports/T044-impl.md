# T044 보고 (2026-11-10 11:10)

- 기준 SPEC: v2.5 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.5 (2026-11-10 10:52 KST)`)
- 브랜치 / 마지막 커밋: lane/engine / `0d3a7b2`

## 결과
완료 — `followUpDate`·`replyFacts`(`src/engine/followup.ts`)와 `buildEscalationSignals`(`src/engine/signals.ts`)를 넣었다. AC30 9건 모두 통과하고, 남은 인수 실패는 지시서가 허용한 AC17 "시연용 배송사 데이터" 5건(`seed/carrier-events.json` 없음, T045 몫)뿐이다. SPEC 7장이 못 박은 서연 건 **6 (High) → 답장 후 3 (Watch)**, 지호 건 17시간/25시간 경계를 단위 테스트에서 `escalationRisk`와 이어서 확인했다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/followup.ts` (새 파일) | `followUpDate` (`FollowUpDateFn`), `replyFacts`, `FOLLOW_UP_DATE_TOKEN`, 공용 UTC 날짜 파서 `parseUtcInstant`·`MS_PER_HOUR`. 정책은 `config/rules.json`의 `reply`를 작은 zod 스키마(`followUpDays`는 1 이상 정수)로 검증해 읽는다 |
| `src/engine/signals.ts` (새 파일) | `buildEscalationSignals`, `SignalInput`, `CARD_COMPANY_TERMS`, `HOURS_TO_DUE_NONE`(= 876000, 100년) |
| `tests/unit/followup.test.ts` (새 파일) | 29건: AC30 경우, UTC·시간대 표기·윤년·달 바뀜, 잘못된 입력 예외, `followUpDays` 0·음수·소수·문자열 거부, 토큰 글자(코드포인트 `⟦` U+27E6 / `⟧` U+27E7), `replyFacts` |
| `tests/unit/signals.test.ts` (새 파일) | 30건: 서연 6→3, 지호 17h/25h/24h 경계, 기한 없음·48h·72h 경계, 낱말 목록 전부 + `카드`만·`bank holiday` 제외, 답장 뒤 재문의, 뒤섞인 순서, 같은 시각, 글 없음, 결정론·입력 불변·예외 |

`tests/acceptance/ac30.followup.test.ts`는 실행만 했다 (고치지 않았다). `src/engine/escalation.ts`·`params.ts`, `config/rules.json`은 읽기만 했다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 139 (+ 9 skipped) | 5 | 실패는 전부 `ac17.seed.test.ts` "시연용 배송사 데이터" (`seed/carrier-events.json` ENOENT). **AC30은 9/9 통과** |
| `npm test` | 1132 (22 파일) | 0 | 이번에 추가한 59건 포함 |
| `npx tsc --noEmit` | 오류 없음 (exit 0) | 0 | |
| `npm run lint` | 오류 없음 | 0 | |

실패한 테스트 (지시서가 허용한 범위):
- `AC17 시연용 배송사 데이터 (v2.5)` 5건 — `seed/carrier-events.json`이 아직 없다. 이 레인의 수정 가능 폴더 밖이라 손대지 않았다 (T045).

## 화면이 부르는 방법
```ts
import { escalationRisk } from '@/engine/escalation';
import { replyFacts } from '@/engine/followup';
import { buildEscalationSignals } from '@/engine/signals';
// buyerMessages: 이전 문의 + 분쟁 접수 글 [{ text, at }], sellerReplies: [{ at }], angryTone: LLM 판별(없으면 null)
const risk = escalationRisk(buildEscalationSignals({ buyerMessages, sellerReplies, now, disputeDueDate: board.dueDate, angryTone }));
const facts = replyFacts({ now, disputeDueDate: board.dueDate }); // [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' }] → fillTokens
```

## 남은 문제
- **시간대 표기가 없는 시각은 UTC로 본다.** `2026-11-10T17:00:00`처럼 `Z`나 오프셋이 없는 입력을 로컬 시간대로 읽으면 같은 입력이 기계마다 다른 날짜를 내므로 UTC로 고정했다 (파일 주석에 적었다). 날짜만 있는 `2026-11-02`는 지시서대로 그날 00:00 UTC다.
- **낱말 목록은 고정 문자열 포함 검사다** (라틴 문자는 대소문자 무시, 이어진 공백·줄바꿈은 한 칸으로 줄여 `credit card\ncompany`도 잡는다). `차지백` 같은 음차나 `은행에 문의하겠습니다`처럼 목록에 없는 꼴은 못 잡는다. `은행`·`bank`·`카드` 한 낱말은 일부러 넣지 않았다 — `bank holiday`·`카드로 결제했어요`가 걸린다 (완료 기준). 지시서 목록에 **띄어 쓴 `이의 제기` 한 항목만 더했다** (같은 말이고 거짓 양성이 늘지 않는다).
- `secondMessageUnanswered`는 "판매자의 마지막 답장보다 늦거나 **같은 시각**인 구매자 글"을 센다. 그래서 마지막 글과 같은 시각에 답장이 있으면 그 글은 무응답으로 보지만(막는 쪽), 그보다 앞선 글은 뒤에 답장이 있으므로 답한 것으로 본다 — 이 경우 연달아 남은 글이 1건이라 신호는 거짓이고, 24시간 무응답 쪽으로만 걸린다. 단위 테스트에 두 경우를 나눠 적었다.
- 구매자 글·판매자 답장 시각을 PayPal 분쟁 messages와 시드 문의에서 어떻게 모을지는 이 레인 밖(ui/data)이다. 엔진은 받은 값만 본다.

## 컨트롤 타워에 요청할 결정
- **공용 날짜 도우미 위치**: UTC 날짜 파서(`parseUtcInstant`)가 `followup.ts`와 `signals.ts` 양쪽에 필요했다. T044의 수정 가능 폴더가 두 파일뿐이어서 `followup.ts`에 두고 `signals.ts`가 `import`하게 했다(엔진 안쪽 의존, ai·ui 레인에는 기대지 않는다). 제 자리는 `src/engine/date.ts`라고 보므로 다음 태스크에서 옮길 허락을 요청한다. 코드를 두 곳에 베끼지 않으려고 이렇게 했다.
- **`SignalInput`을 계약으로 올릴지**: 지시서에만 있고 `src/types.ts`에는 없어서 `src/engine/signals.ts`가 `export type SignalInput`으로 내보낸다. 화면(ui 레인)이 이 타입을 쓰게 되면 `src/types.ts`로 올리는 편이 낫다 (`BuildEscalationSignalsFn`까지 두면 다른 엔진 함수와 모양이 맞는다).
- **참고 (계약 변경은 필요 없다고 본다)**: `PolicyConfig`에 `reply`가 없어서 `followup.ts`는 `config/rules.json`을 직접 `import`해 `reply`만 읽는다 (`params.ts`의 `rulesFromConfig()`는 반환 타입이 `PolicyConfig`라 `reply`가 보이지 않는다). 계약이 `ReplyPolicy`를 따로 둔 뜻에 맞다고 보고 `PolicyConfigSchema`는 건드리지 않았다.
- **참고**: 기한 임박 기준 `DUE_SOON_HOURS`(72)는 `escalation.ts`의 코드 상수이고, 기한 없음 표시 `HOURS_TO_DUE_NONE`(876000시간 = 100년)도 `signals.ts`의 코드 상수다. `PolicyConfig`에 담을 자리가 없어서 그렇게 두었다 — 설정으로 옮길지는 컨트롤 타워 판단이다.
