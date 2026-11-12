# T122c 보고 (2026-11-12 21:00)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / (이 보고서 커밋 — `git log -1`)

## 결과
일부 완료. 시안 v6 한 장 카드 틀(`one-card.tsx`)을 만들었다. 지호·추적·Mike·Prevent 상세를 이 틀로 바꿨고, Lena·Yuki 카드 부품도 만들었다. 지호 카드는 엔진 최선 수로 두 갈래를 고른다. 새 품질 사건이면 repair → send-message, 기존 색상 사례면 offer → make-offer다. 두 갈래 모두 그려진다.
일부 완료인 이유는 두 가지다. 아래 "컨트롤 타워에 요청할 결정" 1·2가 다른 세션의 파일에 걸려 있다.
- **repair 초안이 아직 나오지 않는다.** `cases/reply/load.ts`가 repair 수를 AI 초안 경로에서 뺀다.
- **Lena·Yuki 카드가 화면에 연결되지 않았다.** 연결할 `page.tsx`는 T122b 범위다.

실제 AI·PayPal 호출, 개발 서버 실행, `.env` 읽기는 하지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/one-card.tsx` (새) | 한 장 카드: 구매자 대화(`.zone-buyer`, 언어 이름·원문 `lang`·"Translated ·"·AI read 칩) → 윗줄(AI 알약·제목 20px·설명 15px / "Keeps ≈$N") → "How AI handled this" 번호 원 단계 → 표(`.ag` 틀, 회색 줄) → "What the buyer will receive (L)" 상자(보낸 뒤 #002991) → `children`(관문 알림) → "On approval" + `code` 호출 이름 + 버튼. 훅 없음, 계산 없음, 자리 순서 고정(T118) |
| `src/app/today/one-card-data.ts` (새) | `jihoBranch`(갈래: repair·send_message / make_offer+금액 / null), `approvalApiKey`, `lossOf`(엔진 `recommend().all` 기대 손실 표기만), `buyerMessage`(실제 글 먼저, KO 화면은 번역 줄 없음), `langCode`·`languageName`, `tPick` |
| `src/app/today/offer-work.tsx` | 지호 카드. `kind: 'offer' \| 'message'`. 관문은 그대로다(`canSendOffer` / `canSend` → `sendReplyAction({kind,…})`, 실제 전송이면 확인 창). 보낼 글은 서버가 검사한 전송본만 보이고, 없으면 상자 대신 알림을 낸다. 버튼 "Send" → "Sent ✓"(낙관적, 실패하면 되돌림), 옆에 전송 모드(Simulated) |
| `src/app/cases/case-detail.tsx` | 지호 분기 `jihoWork`. repair 갈래의 제목·설명은 시안 문장, 30일·5주는 시드 `jihoPurchase`, 단계 금액은 엔진 기대 손실, Keeps는 엔진 `actionSavings`. offer 갈래의 제목은 기존 엔진 금액. 초안이 없으면 4단계를 "썼다" 대신 "지금은 AI 초안을 쓸 수 없어요"로 쓴다 |
| `src/app/today/demo-item-card.tsx` (새) | Lena #1029·Yuki #1051 카드(Demo data). 제목·설명·버튼·금액·약속일은 시드 `demoItems`, 구매자 글·초안·단계는 시안 문장. 버튼은 화면 상태만 바꾼다(서버 액션·PayPal·AI·fetch import 0). Lena [Refund $24] → "Refunded ✓" + "Simulated · no money moved". Yuki [Looks good] → "Checked ✓", 호출 칸은 "Simulated · not sent"(Auto 없음) |
| `src/app/today/tracking-detail.tsx` | v6 틀. 4단계, 표 = 실제 미등록 주문(주문·구매자·상품, 분쟁 걸린 주문은 회색 줄), Keeps = 엔진 `trackingSavings`, 호출 이름 = 실제 `POST /v2/checkout/orders/{id}/track · N orders`, 버튼은 기존 `TrackingRegister` 그대로 |
| `src/app/cases/routine-detail.tsx` | Mike: 실제 구매자 글 + 코드 판정 3단계. AI 알약·실행 줄·버튼 없음 |
| `src/app/today/prevent-card.tsx` | v6 틀(AI 알약·단계·실행 줄 없음, 내용 그대로) |
| `src/app/(app)/desk.css` | 끝에 "T122c 한 장 카드" 절(`.oc-*`, 시안 L443–L478 인라인 값과 v6 L50·L52–L66 값 그대로). 다른 세션과 겹치지 않게 접두 `.oc-` |
| `config/copy.en.json`·`copy.ko.json` | `card.*` 65개(시안 DI.en/DI.ko 문장. en·ko 자리표시자 같음) |
| `reports/design-match/v6-diff.md` | B45–B52, C21–C23·C26–C28·C36–C45 "구현 상태" 24행 |
| `tests/unit/app-t122c.test.ts` (새) | 19건: 카드 구조·순서·CSS 값, On approval 호출 이름, 두 갈래(B3 → repair·send-message·$16/$50, B1 → offer·make-offer·720¢), 메시지 갈래 관문, Lena/Yuki Simulated·쓰기 0(코드 검사)·Auto 없음·KO, 추적 호출 이름, 언어 도우미 |
| `tests/unit/app-t106·t067·today·t081.test.ts` | 옛 zone-work 마크업 시험을 v6 틀로 갱신. 같은 값 키(호출 이름·독일어/일본어 원문)를 허용 목록에 추가 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (+9 skip) | 0 | AC35 포함 |
| npm test (`vitest run tests/unit`) | 2661 | 1 | `storefront.test.ts > 결정론 100회` 시간 초과(5s). 이 변경과 무관하다. 따로 돌리면 통과한다(T120 보고와 같은 현상) |
| npx tsc --noEmit | 0 오류 | | |
| npm run lint | 0 오류 | | 경고 5 (기존 `tests/unit/repair.test.ts` 등) |
| npm run build | 성공 | | |

자동 비교 도구(T123) 판정은 받지 않았다. 위 "구현 상태"는 자기 기록이고 근거가 아니다(20:45 결정).

## 남은 문제
- 이번 커밋 기준으로 repair 갈래에는 초안 상자 대신 알림이 나오고 [Send]가 꺼진다. 원인은 요청 1이다. 정직한 상태지만 시안과 다르다.
- 시안에 있는 지호 구매자 문장("소매 올이 풀려서…")은 쓰지 않았다. 실제 분쟁 글이 들어온다. 단계 1도 그 글의 구체적 내용 대신 "구매 N주 뒤 품질 문제"로 쓴다.
- AI read 칩은 데모 항목에만 있다. 실제 사건에는 판정 태그 데이터가 없다.
- 추적 카드의 수는 실제 미등록 주문 수(2건, O05·O07)다. 목록의 시드 표시 줄 "5 orders"(T121)와 다를 수 있다. 목록 쪽은 T122b 범위다.
- Mike(bm) 카드에는 시안의 증빙 초안과 `provide-evidence` 줄·[Send proof]가 없다. 실행 코드가 provide-evidence를 지원하지 않기 때문이다(`src/exec/request.ts` ENDPOINTS). 실제 호출 이름만 쓴다는 규칙도 있다.
- kc(통관번호) 항목은 이 화면에 없어서 카드도 없다.
- Lena 초안의 "Ich habe Ihnen soeben … erstattet"(방금 환불했어요)는 시안 문장 그대로 뒀다. 화면에는 "Simulated · no money moved"가 함께 보인다. 요청 3 참고.

## 컨트롤 타워에 요청할 결정
1. **repair 초안 연결 (T122a 범위 `src/app/cases/**`, 한두 줄).** 둘 다 "T120b 전" 임시 코드다.
   - `src/app/cases/reply/load.ts:99-100`의 `move = best?.move === 'repair' ? null : …`가 repair를 AI 초안·번역 경로에서 뺀다.
   - `src/app/cases/view/load.ts:78`도 repair면 초안 없음으로 처리한다.
   - T120b는 끝났다. 이 두 줄을 풀고, repair 수일 때 `facts`에 `repairFacts(locale)`(`src/ai/repair.ts`)를 넣어야 한다.
   - 그래야 "What the buyer will receive (Korean)" 상자와 [Send]가 켜진다. 캐시(`data/ai-cache`)에 repair 초안이 없으면 배포에서 AI를 한 번 불러야 한다.
   - `config/rules.json`의 `reply.repairDays`(T120b 요청 1)도 아직 없다.
2. **Lena·Yuki 카드 화면 연결 (T122b 범위 `src/app/(app)/page.tsx`).** 목록에 데모 항목이 생기면 `Pane`에서 다음처럼 그린다.
   ```tsx
   <DemoItemCard item={seedDemoDisplay.demoItems의 그 줄} row={item.row} doneId={item.id} />
   ```
   부품은 `src/app/today/demo-item-card.tsx`에 있고, 값은 시드 줄 그대로 넘기면 된다.
3. Lena 초안의 "방금 환불했어요" 문장을 시안대로 둘지, "승인하면 환불돼요" 같은 문장으로 바꿀지 정해 주세요(환불 약속 예외 검토, V6-C41). 지금은 시안 그대로다.
4. `src/app/today/today.css`의 옛 `.offer-work-*`·`.tracking-orders`·`.tracking-table` 규칙은 이제 쓰지 않는다. 그 파일은 T122b 범위라 그대로 뒀다.
