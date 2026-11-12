# T122g 구현 보고 — repair 메시지 전송 허용

- 기준 SPEC v2.16 / 모델 sonnet-5-5 / 브랜치 lane/ui-scenes

## 한 일
- `src/app/_server/send.ts`
  - 메시지 전송의 계획 검사: 추천이 `fight` **또는 `repair`**면 통과 (`apiMove === 'send_message'` 조건은 그대로). offer 경로(`make_offer`)·환불 경로 무변경.
  - 서버 사실값 재생성에 `withMoveFacts(..., best.move)` 추가 (화면 `reply/load.ts`와 같은 함수). 이게 없으면 repair 답장의 `⟦DAYS_1⟧` 사실값 때문에 `sameFacts`가 항상 실패해 repair는 전송이 막혔을 것이다. fight/offer는 `withMoveFacts`가 그대로 돌려줘 결과 무변경.
  - 관문 무변경: 공개 모드 simulated(쓰기 0)·recording만 실제 전송, 약속·토큰·서버 재검사 그대로.
- `tests/unit/app-t122g.test.ts` 신규 4건: repair 추천 사건 Send → simulated 성공·실제 호출 0·가짜 1 / DAYS 사실값 없는 답장은 막힘 / fight 사건에 repair 사실값을 넣은 답장은 막힘(호출 0).

## 검증
- vitest: app-t122g, app-send, app-t064-activity, app-t122f, ops-t070-gates 통과.
- eslint(send.ts, 새 시험) 통과.

## 못 한 것 / 컨트롤 타워에 요청할 결정
1. **`src/ai/tokens.ts` 수정은 권한 설정에서 거부됐다** (`src/ai/`가 이 세션에서 편집 불가). `repairDaysFact`의 `'DAYS' as FactToken['kind']` 단언과 그 위 주석 한 줄("계약에 DAYS가 들어가면…")은 이제 불필요하다. 동작에는 영향 없음 — 지울 때 `kind: 'DAYS'`로 바꾸고 주석 삭제.
2. **`npx tsc --noEmit` 오류 1건**: 계약에 `DAYS`가 들어와 `src/app/cases/reply-model.ts:290`의 `FACT_LABEL: Record<FactToken['kind'], string>`에 `DAYS` 키가 없다. 고치려면 그 줄과 문구 키(`case.reply.fact.DAYS`, `config/` 쪽 화면 문구)가 필요한데 이 지시서의 수정 가능 폴더 밖이라 손대지 않았다. 후속 지시서(예: T122h)로 요청.

## 재시도(후속) — FACT_LABEL DAYS
- `src/app/cases/reply-model.ts` FACT_LABEL에 `DAYS: 'case.reply.fact.DAYS'` 추가.
- `config/copy.en.json` `"case.reply.fact.DAYS": "Repair time"`, `config/copy.ko.json` `"case.reply.fact.DAYS": "수선 기간"` (자리표시자 없음, en/ko 키 동일).
- `npx tsc --noEmit` 0 오류. `npm run lint` 오류 0 (경고 5건, 기존).
- vitest `app-t113` + `app-t122*`: 82 통과 / 1 실패. 실패: `app-t122d.test.ts` T122d-3 — `src/app/(app)/page.tsx`에 `item.kind === 'demo') return null` 문자열을 기대하는 소스 정규식 검사. 이번 변경과 무관(내가 건드리지 않은 파일·시험, 이전부터 실패로 보임). 컨트롤 타워가 기대값/출처 파일 판단 필요 — 시험(`tests/`)은 수정하지 않았다.
- 개발 서버·AI·PayPal 호출·.env 읽기 없음.
