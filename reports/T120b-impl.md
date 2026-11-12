# T120b 보고 (2026-11-12)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ai / (커밋 후 `git log -1` 참조)

## 결과
일부 완료 — repair 초안·토큰·약속 검사·시험은 끝났다. 다만 `config/rules.json` 편집이 권한 설정으로 막혀 `repairDays` 키를 넣지 못했다 (아래 요청 1).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/ai/prompts/reply.ts` | `ReplyMove`에 `'repair'`, 초안 지침 `- repair:` (공감 → 반품 기간 지나 반품 어려움(숫자·날짜 금지) → 왕복 배송비 부담 시 "free repair" → `⟦DAYS_1⟧` 수선 기간, 토큰이 없으면 문장 생략, 금액·환불·교환·할인·보상 금지). `DAYS` 토큰 기본 뜻 |
| `src/ai/reply.ts` | `ALLOWED_SLOTS.repair = []`(금액 자리표시자 없음), `ALLOWED_COMMITMENTS.repair = []`(돈 드는 약속 전부 정책 밖) |
| `src/ai/tokens.ts` | 토큰 종류 `DAYS` 추가 (로컬 `TokenKind`로 넓힘), `formatFact('DAYS')` = `5영업일`/`5 business days`/`5営業日`/`5 Werktage`, `repairDaysFact()` |
| `src/ai/repair.ts` (새) | `repairDaysFromConfig()`·`repairFacts()` — `reply.repairDays`를 읽어 `⟦DAYS_1⟧` 사실값 생성. 키가 없으면 `[]`(기간 문장이 빠지고 지어낸 기간은 안 나감) |
| `tests/unit/reply-repair.test.ts` (새) | 8건: 프롬프트·값 비노출, 토큰·약속 검사 통과, 전송본 `sendable`+일수 채움, 환불 약속은 `outsidePolicy`, 금액 자리표시자·모르는 토큰·글자로 쓴 기간 거부, 언어별 표기 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `vitest run tests/unit/reply-repair.test.ts` | 8 | 0 | |
| `vitest run tests/unit` | 2611 | 2 | 아래. reply·tokens·commitments 시험은 모두 통과 |
| `npm run test:acceptance` | 179 | 3 | AC35 (엔진 T120 소관, 이 태스크와 무관) |
| `npx tsc --noEmit` (`src/ai`·`tests`) | — | 0 | `src/ai` 오류 0 |

실패 원인(모두 이 변경과 무관):
- `app-t087-listing` ".next/static에 서버 전용 값" — `.next` 빌드 산출물 의존.
- `storefront` "결정론 100회" — 7초대 시간 초과(성능 시험), ai 코드 아님.
- AC35 3건 — 엔진에 repair 평가가 아직 없음 (T120 레인).
- `tsc`: `src/app/cases/model.ts(224)` `Record<..., 'repair'>` 누락 — ui 레인 소관. `src/app/cases/{reply,view}/load.ts`의 `ReplyMove` 오류는 이 변경으로 사라졌다.

## 남은 문제
- 시안 v6 문장은 스타일만 참고했고, 시험용 초안은 새로 썼다. 캐시(`data/ai-cache`) 재생성은 하지 않았다 (실제 AI 호출 금지).
- repair 초안이 "free repair"·"왕복 배송비는 손님 부담"을 쓰는 것은 약속 낱말 목록(`free shipping`, `at no cost`, `cover the shipping` 등)을 피한 표현에 의존한다. 프롬프트가 못 박고 시험이 지키지만, 모델이 `at no cost`로 쓰면 `outsidePolicy: free_shipping`으로 판매자 확인 대상이 된다 (막는 쪽으로 틀린다).
- 호출하는 쪽(`src/app`)은 `repair` 수일 때 `facts`에 `repairFacts(locale)`를 넣어야 `⟦DAYS_1⟧`가 채워진다 (ui 레인 몫).

## 컨트롤 타워에 요청할 결정
1. **`config/rules.json`에 `"repairDays": 5`를 `reply` 아래(`followUpDays` 다음)에 추가해 주세요.** 이 세션은 `config/` 편집이 권한 설정으로 거부됐다. 그때까지 `repairFacts()`는 `[]`를 돌려주고 기간 문장은 빠진다. (AC31이 `reply` 칸을 `strict`로 보지 않는지는 확인하지 못했다. 코드는 `reply`의 다른 칸을 이미 무시한다.)
2. **`src/types.ts`의 `FactToken['kind']`에 `'DAYS'` 추가.** 지금은 `tokens.ts`에서 로컬 `TokenKind`로 넓히고 `repairDaysFact()`에서 `as FactToken['kind']`로 한 번 단언했다. 계약에 들어가면 이 단언을 지울 수 있다.
