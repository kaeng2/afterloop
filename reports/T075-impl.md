# T075 보고 (2026-11-11 20:41)

- 기준 SPEC: v2.11   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / fa34965 (보고서 커밋은 그 다음)

## 결과
완료. 함수 5개와 단위 테스트를 만들었다. **다만 AC33은 9개 중 8개가 건너뛰어진다.** 원인은 인수 테스트 파일 쪽에 있다 (아래 "컨트롤 타워에 요청할 결정" 1번). 그래서 AC33의 단정을 단위 테스트(`tests/unit/forecast.test.ts` 첫 묶음)에 정적 import로 옮겨 돌렸고, 모두 통과한다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/reply-features.ts` (새) | `detectReplyFeatures` (`DetectReplyFeaturesFn`), `splitSentences`, `noReplyFeatures`, `REPLY_FEATURE_KEYS` |
| `src/engine/forecast.ts` (새) | `forecastReply`, `riskCurve`, `weeklySummary` (계약), 계약 밖 `forecastMoves`, `replyCalibration`, `replyModelFromConfig`, 모델 설정 zod 검증 |
| `tests/unit/reply-features.test.ts` (새) | 특징별 영어·한국어, 날짜 꼴, lang, hits·문장 나누기, 긴 입력 7종(각 200ms 이내) + 4배 길이 선형성 |
| `tests/unit/forecast.test.ts` (새) | AC33 단정 재실행, 기본 초안 8종 × 늦은 날 3종에서 정확히 3680, 지호·buyer_m 보드, 보정 없는 보드, mood, forecastMoves, riskCurve, weeklySummary |

`src/engine/params.ts`는 고치지 않았다 (모델 설정 읽기·검증은 `forecast.ts` 안에 뒀다).

## 보정 방법 (DECISIONS 기록 요청 — 5줄)
1. 보정 상수 c 하나를 차지백 로짓 z와 환불 나눔 로짓 qz에 **함께** 더한다 (`parts`의 `calibration` = c).
2. 기대 비용 = t + A·pRefund + (A+f)·pCB 는 c에 대해 엄격히 증가하고, c → ±∞에서 t와 A+f+t로 간다. 그래서 0 < p_win < 1인 fight 손실 (1−p_win)(A+f)+t는 **기본 초안이 무엇이든** 맞출 수 있다 (z에만 더하면 "It should arrive soon." 같은 초안에서 범위를 벗어난다).
3. c는 기본 초안(`anchorText`)의 특징, 같은 신호·늦은 날 수로 [−60, 60]에서 이분법 200회로 찾는다 (결정적, 난수 없음).
4. 입력 글은 같은 c 위에서 자기 특징 가중치만큼 움직인다. 비용은 `roundCents`(소수 6자리 정리 후 사사오입)로 센트 정수 → 기본 초안이면 recommend의 fight 정수와 정확히 같다.
5. fight 평가가 없거나 막힌 보드(send_message 없음, 원인 없음)는 c = 0 (보정 없이 시안 가중치 그대로). 기본 초안에 refundNow가 있으면 하한이 t+0.97A라 못 맞출 수 있다 (가까운 끝으로 붙음, AI 초안은 환불 약속 금지라 실제로는 생기지 않는다).

## 수별 예측 규칙 (`forecastMoves`, 화면 선택지 카드용)
입력: `{ anchorText, board, signals, delayDays, translated? }` → `recommend(board).all` 순서·개수 그대로 `{ move, expectedLossCents, pChargeback, blockedBy? }`.
- `expectedLossCents`: recommend 값 그대로 옮긴다 (바꾸지 않음).
- fight: 기본 초안의 pChargeback.
- refund: 기본 초안 특징 + refundNow (전액 환불하고 알린다), 같은 보정.
- offer: 수락되면 해결(차지백 없음), 거절되면 fight로 간다 → (1 − p_acc) × fight의 pChargeback (recommend의 offerLoss 구조와 같다).
- 막힌 수(예: 서연 offer = OFFER_SCOPE): `pChargeback: null`, `blockedBy` 그대로.

## 서연 예시값 (고정 가정값 P·R, 신호 4개 모두 켜짐, delayDays 0, 시험용 기본 초안)
| 글 | pWait | pRefund | pChargeback | 기대 비용 | mood | 띠 | c |
|---|---|---|---|---|---|---|---|
| 기본 초안 (영어, translated 없음) | 0.5840 | 0.0928 | 0.3232 | **3680** | −0.085 | annoyed | 0.261 |
| 기본 초안 (translated: true → lang 켜짐) | 0.5775 | 0.1306 | 0.2919 | **3680** | −0.071 | annoyed | 0.614 |
| 기본 초안 + 탓하는 문장 | 0.3448 | 0.0904 | 0.5648 | 5765 | −0.398 | annoyed | 0.261 |
| 빈 글 (답장 안 함) | 0.1007 | 0.0876 | 0.8117 | 7892 | −0.717 | angry | 0.261 |

수별: 서연 fight 3680¢ / 32.3%, offer 막힘, refund 7400¢ / 2.3%. 지호 fight 4610¢ / 59.9%, offer 1953¢ / 16.8%, refund 5000¢ / 6.9%.
위험 곡선(AC33 사건 5개, 보정 0): 0.378, 0.378, 0.378, 0.475, 0.992.

## 판단 규칙
- **lang**: 글이 비어 있지 않고, (한글·가나 글자가 있거나 `translated === true`)이면 참. `translated`는 계약 밖 선택 인자다 — `detectReplyFeatures(text, { translated })`, `forecastReply({ ...input, translated })`. 영어 초안이 보낼 때 한국어로 번역되면 화면이 `true`를 넘긴다. 독일어 등 라틴 글자 언어는 글자로 알 수 없어 `translated`로만 켜진다.
- **문장 나누기**: 줄바꿈, 또는 `. ! ? 。` 뒤에 공백·끝이 오면 끊는다. 월 약어·Mr/Mrs/Ms/Dr 뒤 마침표는 끊지 않는다 ("Nov. 17" 한 문장 — 시안의 나누기는 여기서 날짜를 놓친다).
- **날짜**: 영어 월 이름 전부(약어 포함) + 일("November 17", "Nov. 17", "17 November", "17th of Nov"), "N월 N일", "M/D". 알려진 한계: "may 2"처럼 월 이름과 같은 단어 뒤 숫자도 날짜로 본다.
- **시안에서 넓힌 것**: cause에 clearance·colour/color·size·색상·사이즈 (지호 같은 색상 분쟁), ask에 customs code·please send/share/provide·보내주, refundNow에 issued/processed a refund·환불 처리했. "refund"라는 말만으로는 아무 특징도 켜지지 않는다.
- **시간**: 문장 나누기는 한 번 훑기, 정규식에 중첩 반복이 없다. 10만 자 입력 7종 모두 200ms 이내, 길이 4배 → 시간 16배 미만(선형) 테스트.
- **늦은 날 수**: 음수·NaN·무한은 0으로 본다 (예외를 던지지 않는다 — 화면 렌더링 중 호출되므로).
- **riskCurve**: threat·angry는 한 번 표시되면 이후 계속 켜짐. unanswered는 'unanswered' 표시 구매자 메시지 뒤에 seller_reply가 없으면 켜짐, 늦은 날 수 = 그 메시지부터 그 사건까지 온전한 날 수. seller_reply가 무응답·늦음을 지운다.
- **weeklySummary**: refund 평가가 없거나 막힌 분쟁, best가 없는 분쟁은 0을 더한다 (AC33의 기대식 `refund ?? 0` − best는 refund가 없을 때 음수가 되는데, 두 시험 보드에는 해당하지 않는다).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 159 (17 skipped) | 0 | AC33: 1 통과 + **8 건너뜀** (아래 결정 1). 나머지 건너뜀 9개는 AC13 샌드박스(자격 증명 없음) |
| `npm test` | 2136 | 0 | 새 파일 2개 56개 포함 (AC33 단정 재실행 4개 포함) |
| `npx tsc --noEmit` | 오류 없음 | 0 | |
| `npm run lint` | 경고·오류 없음 | 0 | |

## 남은 문제
- **완료 기준 "AC33 9개 모두 통과 (건너뜀 없이)"는 인수 테스트 파일을 고치지 않고는 채울 수 없다** (결정 1).
- **위험 곡선의 보정**: 계약 `RiskCurveFn`에는 기본 초안이 없어 forecastReply와 같은 c를 계산할 수 없다. 계약 밖 선택 6번째 인자 `opts.calibration`을 두었다 — 화면이 `forecastReply(...).parts`의 `calibration` 값(또는 `replyCalibration(input)`)을 넘기면 같은 보정이고, 마지막 점 = 같은 상황의 빈 글 위험이 된다(테스트로 확인). 넘기지 않으면 c = 0 (시안 가중치 그대로). ui(T076)에 알릴 필요가 있다.
- **추적 없음(tracking_missing)**: 지시서는 곡선 입력에 넣으라고 했지만 `config/reply-model.json`에 가중치가 없다. 코드에 숫자를 쓸 수 없어 위험에 넣지 않았다 (점은 그대로 하나 찍힌다).
- 보정 c는 기본 초안에 따라 달라진다 (AI 초안이 열 때마다 다르면 빈 글 위험도 조금씩 다르다. 예: "Sorry for the wait. I will check with the carrier."가 기본 초안이면 빈 글 위험 ≈ 0.42, 시험용 기본 초안이면 0.81). 숫자 일치 조건에서 나오는 성질이다.
- 서연 기본 초안 + translated에서 c가 0.26 → 0.61로 바뀐다 (lang이 기본 초안에도 켜지므로). 화면이 `translated`를 넘길지는 한 가지로 정해 두는 편이 좋다.

## 컨트롤 타워에 요청할 결정
1. **AC33 파일이 늘 건너뛴다 (인수 테스트 수정 요청)**. `it.skipIf(skip())`의 `skip()`은 **테스트 수집 시점**에 평가되고, `fc`·`ft`를 채우는 `beforeAll`의 동적 import는 그 뒤에 돈다. 그래서 모듈이 있어도 `fc === null`이라 8개가 늘 건너뛴다 (지금 결과: 1 통과, 8 skipped). 고치는 예: 파일 맨 위에서 `const fc = await import(f).catch(() => null)` (최상위 await) 로 모듈을 먼저 읽고 `skipIf`에 쓰거나, `skipIf`를 빼고 `it(..., (ctx) => { if (skip()) ctx.skip(); ... })`로 실행 시점에 판단한다. 같은 단정을 정적 import로 돌린 결과(`tests/unit/forecast.test.ts` 첫 묶음 + 보정 묶음)는 모두 통과한다 — 기대값 자체는 맞다고 본다.
2. **DECISIONS 기록**: 위 "보정 방법 5줄"을 옮겨 적어 달라 (사람 결정: 맞추는 방법은 엔진 세션이 정하고 DECISIONS에 적는다).
3. (선택) `RiskCurveFn`에 보정 값을 넘길 자리를 계약에 올릴지 — 지금은 계약 밖 선택 인자 `opts.calibration`. `forecastMoves`·`replyCalibration`·`translated`도 계약 밖이다. 화면이 쓰게 되면 계약 10부로 올릴지 정해 달라.
4. (선택) `tracking_missing` 가중치를 `config/reply-model.json`에 넣을지 (가정값이라 사람 결정 필요).
