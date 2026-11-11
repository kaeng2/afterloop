# T099 보고 (2026-11-12)

- 기준 SPEC: v2.15 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-names (지시서의 lane/ui 대신 사람 지시로 이 worktree 브랜치) / 9f93f48 (보고서 커밋 별도 없음 — 이 파일은 같은 브랜치에 이어 커밋)

## 결과
완료. 미리보기 제목이 구매자 이름이 되었고(대명사 없음), Today Prevent 행은 `/products` 링크 대신 오른쪽 짧은 카드로 열린다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `config/copy.en.json`, `config/copy.ko.json` | `case.reply.sheSees` = "{{name}} will see ({{language}})" / "{{name}} 님에게 보이는 글 ({{language}})". Prevent 카드 문구 `today.prevent.title/body/fixesLabel/fixSaving/note` (금액·퍼센트는 자리표시자) |
| `src/app/cases/reply/reply-panel.tsx` | 한 줄만: `t('case.reply.sheSees', { name: buyerShort, language })`. Send·editGate는 건드리지 않음 (T100과 겹침 없음) |
| `src/app/today/model.ts` | Prevent 항목 href `/?item=<SKU>`(거르개 유지), `prevent: PreventDetail`(엔진 `pickPreventProduct` before/after/cutPercent + `fixSavings`가 0보다 큰 처방). `selectItem`: 주소로 고른 Prevent는 열림, 처음 열 때는 고르지 않음 |
| `src/app/today/prevent-card.tsx` (새) | 짧은 카드. 버튼·링크·폼 없음 → 쓰기 0 |
| `src/app/(app)/page.tsx` | Prevent 선택 시 `PreventCard` 렌더 |
| `src/app/today/today.css` | 카드 줄 스타일 (변수 색만) |
| `src/app/_shared/nav-items.ts` | `/products` 항목 제거 (NAV_ITEMS = Today) |
| `tests/unit/app-t099.test.ts` (새) | 서연·지호 제목, 대명사 없음, 카드 숫자 = 엔진 값, 카드에 button/a/form 없음, Desk 코드에 /products·/listing 링크 0 |
| `tests/unit/app-today|shared|t061|t068|t076|t090.test.ts` | 바뀐 동작에 맞춰 기대값 갱신 (이름 인자, 탭 1개, Prevent 주소) |
| `reports/design-match/inventory.md` | `sc-if showKo`, `onClick oc.run`(kc) 행 근거 갱신 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2423 | 0 | |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run test:acceptance | 177 (9 skipped) | 0 | |
| npm run build | 통과 | 0 | |

전체 vitest 첫 실행에서 `storefront.test.ts` 결정론(100회 반복) 시험이 5초 제한에 걸렸으나 병렬 부하 때문이었고, `npm test`에서는 통과했다.

## 남은 문제
- 시안 kc의 "Ask 3 Korean buyers for customs IDs"·[Send in Korean]·save 72는 근거 있는 데이터·숫자가 없어 쓰지 않았다. 카드는 정보 카드(버튼 없음)다. 처방 실행 버튼이 필요하면 별도 결정이 필요하다.
- 제목 이름은 `buyerShort`(이름만). 이름을 모르면 기존 `buyerReadsUnknown`("구매자가 읽는 글") 그대로.
- 화면을 실제로 띄워 보지 않았다 (개발 서버 금지). 스크린샷 확인 필요.

## 컨트롤 타워에 요청할 결정
- 없음
