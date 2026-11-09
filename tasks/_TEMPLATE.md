# T0xx: <작업 이름>

| 항목 | 값 |
|---|---|
| 기준 SPEC | v? (시작할 때 `SPEC.md` 첫 줄과 비교. 다르면 작업하지 말고 보고) |
| 레인 | engine / paypal / ai / ui / data |
| 브랜치 / worktree | `lane/<레인>` / `../afterloop-wt/<레인>` |
| 예상 시간 | 2시간 이내 |
| 의존 | T0xx (완료되어 있어야 시작) |

## 수정 가능 폴더
- `src/...`
- `tests/unit/<모듈>.test.ts`

이 밖은 수정하지 않는다. 특히 `SPEC.md`, `src/types.ts`, `tests/acceptance/`, `tasks/`, `TASKS.md`, `DECISIONS.md`.

## 목표
<한두 문장. 무엇이 되면 끝인지>

## 입력 / 출력 타입
- 입력: `src/types.ts`의 `...`
- 출력: `src/types.ts`의 `...`
- 공개 함수: `<경로>`의 `export function ...` (`...Fn` 시그니처를 따른다)

## 완료 기준
- [ ] 인수 테스트 `AC..` 통과 (`npm run test:acceptance`)
- [ ] 자기 단위 테스트 통과 (`npm test`)
- [ ] `npx tsc --noEmit` 오류 없음 (자기 파일 기준)
- [ ] <그 밖에 확인할 것>

## 하지 않을 것
- 다른 레인 폴더 수정
- 계약·인수 테스트 수정 (필요하면 보고서에 요청)
- <이 작업 범위 밖의 기능>

## 보고 위치
`reports/T0xx-<YYYYMMDD-HHMM>.md` (`reports/README.md` 형식). 보고 후 멈춘다.
