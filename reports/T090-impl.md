# T090 보고 (2026-11-12 00:55)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 0627704 (구현). 이 보고서는 다음 커밋

## 결과
완료 — 지시서 "만들 것" 1~11과 모션 절(Desk 몫)을 구현했다. 데이터·안전장치(엔진 숫자, 데모 모드, 보내기 관문, 승인 버튼)는 그대로이고, 검사가 실패하면 Send가 꺼지고 Details가 자동으로 펼쳐진다. 카드 고르기 재계산·Add/Remove 칩·Send 뒤 진행(T091·T092)은 만들지 않았다 — 자리와 모양만 있다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `config/motion.json` (새) | Desk 몫 모션 값 (시안 그대로): hover .15s, 선택지 카드 .15s, 곡선 .3s, 끝점 ping 1.4s ease-out r 7→20 opacity .6, 반응 막대 .35s, 답장 칸 테두리 .3s. Scene 3 키(`scene3`)는 T094 몫 — 스키마가 그대로 통과시킨다 |
| `src/app/_shared/motion.ts` (새) | motion.json zod 검사 + `--motion-*` css 변수 만들기 (`motionVars`) |
| `src/app/layout.tsx` | 루트 `<html style>`에 모션 변수 (모든 화면 공통) |
| `src/app/globals.css` | "AI" 알약(`.ai-pill`, 시안 `.ai` 값), `@keyframes motion-ping`, `prefers-reduced-motion`이면 변수 0s(!important) + 전환·애니메이션 끔 |
| `src/app/_shared/badges.tsx` | 출처 표시 3종: `codeDecides` → 그리지 않음, `aiSuggests` → "AI" 알약 (`AiPill`). 모든 화면(지호·Mike·Products·/listing)에 같이 적용 |
| `src/app/_shared/top-bar.tsx`, `shell.css` | 로고·꼬리표·날짜 왼쪽, 공개 데모 글자(작은 회색)·탭·PayPal activity·EN/KO·판매자는 오른쪽에 작게 (기능 그대로) |
| `src/app/cases/view/case-view.tsx` | 머리글 "High · Score 6" 펼침 제거, 선택지 카드 아래 두 줄 제거, Code decides 배지 제거, AI 알약 |
| `src/app/cases/view/conversation.tsx` | 대화 사이 "Carrier: …" 줄 제거, 말풍선 흰 바탕 실선 + 아래 "Translated · 영어 · 날짜", 태그 "AI read" + 2개까지, 시연용 말풍선은 끝에 Demo data 하나 |
| `src/app/cases/view/risk-curve.tsx` | 100%·50% 눈금 글자, 끝점 물결 원(ping), 점선·끝점 transition |
| `src/app/cases/view/case-history.tsx` | 펼친 줄의 표시 = 빨간 "Before DisputeLess · <표시>" (실제 기록의 표시만), 요약은 AI 알약 |
| `src/app/cases/view/case.css` | 위 모양 + 선택지 카드 transition/hover, Best = 알약 그라데이션 |
| `src/app/cases/reply/reply-panel.tsx`, `reply.css` | 알약 안 Assumption 제거, 칩 줄 "As you type · N good" + ✓ 칩(경고 칩 빨강 글자) + 오른쪽 "Details ⌄", Details 안 = "PayPal data only" → 역번역 → 검사 3개, 맨 아래 검사 줄 제거("Simulated send" 작은 글씨는 Send 왼쪽), 미리보기 #F6F7F9·테두리 없음·"She'll see (Korean)", 반응 막대 width transition, 지호 제안 카드도 같은 Details |
| `src/app/cases/reply-model.ts` | 순수 함수 `detailsChecks`, `detailsMustOpen`(검사 실패 또는 번역이 더한 약속 → 펼침). 관문(`canSend`)은 그대로 |
| `src/app/cases/case-detail.tsx` | Details 첫 줄 값(`desk.paypalOnly`, 배송사 기록이 없으면 "No carrier data …")을 답장 칸에 넘김 |
| `src/app/cases/routine-detail.tsx` | Mike 상세의 Code decides 배지 제거 |
| `src/app/today/today.css` | 목록 줄 hover transition |
| `config/copy.en.json`, `copy.ko.json` | 새 키 7개 (en=ko 키 집합 같음), `badge.aiSuggests` = "AI", `buyerReadsUnknown` 문구 |
| `tests/unit/app-t090.test.ts` (새) | 완료 기준 4개 + 만들 것 1~10 + 모션 (24개) |
| `tests/unit/app-*.test.ts` 9개 | 옛 배치(검사 줄·위험 펼침·배송사 줄·Code decides·"reads (Korean)")를 기대하던 단언을 T090 배치로 바꿈. 숫자 단언은 바꾸지 않았다 |

손대지 않은 것: `_server/send.ts` 관문, `mode.ts`, `activity.ts`, 엔진, `tests/acceptance/`.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 파일 |
| npm test | 2344 | 1 | `storefront.test.ts > 결정론 100회`가 전체 실행 때 5초 시간 초과. 작업 전 기준 실행에서도 같은 실패(시간 초과)였고, 혼자 돌리면 31/31 통과. 엔진 레인 시험이라 손대지 않음 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | 빌드 뒤 T087 `.next/static` 시험도 통과 (작업 전에는 낡은 빌드 때문에 실패했었다) |

완료 기준 대조:
- 검사 하나 실패(가짜) → Send 꺼짐 + Details 펼침: `app-t090` "완료 기준 1" (새 약속 실패 → `disabled`, `aria-expanded="true"`, 실패한 줄 보임), `app-t068` 보조 검사 실패도 같은 동작
- Code decides·AI suggests 점선 배지 없음, Assumption·Demo data·AI 알약 있음: `app-t090` "완료 기준 2" (화면 전체 + src/app 정적 검사)
- AC33 숫자 일치: `app-t090` "완료 기준 3"(같은 화면 안에서 반응 막대 = Reply 카드 = 엔진 fight) + 기존 `app-t079` 그대로 통과. 공개 모드 쓰기 0회: 관문 파일 무변경, `app-send`·`ops-t070-gates` 그대로 통과
- copy en/ko 키 집합 같음: `app-t090` "완료 기준 4", `app-t081`
- 모션·reduced-motion: `app-t090` "모션" (시안 파일의 값과 motion.json 비교, css는 변수만, reduced-motion이면 0s·animation none)

## 남은 문제
- **화면 스크린샷을 찍지 않았다** (개발 서버 금지). UI 병합 전 스크린샷 확인이 필요하다.
- 입력칸 테두리·모서리 알약 색을 위험 50% 이상이면 빨강으로 바꾸는 시안 동작(`editorSt`/`pillSt`)은 넣지 않았다. 기준값(0.5)이 화면 판정 기준이라 config 자리가 없고, 글이 바뀔 때 일어나는 동작이라 T091 몫으로 남겼다. 전환 시간(.3s)은 이미 붙어 있다.
- 말풍선 꼬리의 "From PayPal" 글자를 뺐다 (시안 "Translated · 영어 · 날짜"). 실제 글과 시연용 글은 Demo data 유무로 구분된다.
- 대화 사이 배송사 줄을 빼서 통관 보류 사건은 사건 기록 카드("Show history")에만 보인다.
- `cached` 배지(SPEC 9-4장, Products 거래 줄)는 출처 표시가 아니라 데이터 신선도 표시로 보고 남겼다.
- 지금 안 쓰는 css 규칙(`.work-ai`, `.case-carrier-line`, `.case-bubble-en/-meta`, `.choice-paypal-only`, `.reply-inline`/`.reply-checks`)이 남아 있다. 동작에는 영향이 없다.

## 컨트롤 타워에 요청할 결정
- **"She'll see (Korean)"의 대명사**: 지시서 8번대로 제목을 시안 문구 "She'll see (Korean)"로 바꿨다. 그런데 이전 T068 시험에는 "대명사 없음 (성별 데이터가 없다)"는 단언(`not.toMatch(/\b(She|He) reads\b/)`)이 있었다. 구매자 성별은 데이터에 없다. 이름으로 쓰기("Seo-yeon will see (Korean)")로 되돌릴지 정해 주면 문구 키 하나(`case.reply.sheSees`)만 바꾸면 된다. 이름을 모르는 구매자는 지금도 "The buyer will see (…)"다.
- `config/motion.json`은 지시서가 만들라고 한 파일인데, 지시서 "수정 가능 폴더" 목록(`src/app/**`, `config/copy.*.json`, `tests/unit/`)에는 없다. 지시서 본문대로 만들었다 — 레인 소유권 표(SPEC 11·12장)에 이 파일을 적어 줄지 정해 주면 된다.
