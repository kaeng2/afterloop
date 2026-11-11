# T097 보고 (2026-11-12 00:52)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ops / (커밋 직후 `git log -1`로 확인)

## 결과
완료. `scripts/design/inventory.ts`가 시안 3개에서 표 5개를 자동으로 뽑아 `reports/design-match/inventory.md`를 만들었다 (스크립트를 실제로 돌려 생성). 각 행 끝에 빈 "상태"·"근거" 칸이 있고, 다시 돌려도 채운 칸은 유지된다.

실행: `npx tsx scripts/design/inventory.ts` (package.json은 수정 불가라 명령 추가 없음). 같은 시안이면 파일을 다시 쓰지 않는다 ("변경 없음" 출력, 두 번 돌려 확인).

## 행 수 (실제 시안)
| 파일 | 해시 | 1 색 | 2 모션·타이밍 | 3 누를 것 | 4 접힘·펼침 | 5 조건부 스타일 | 합계 |
|---|---|---|---|---|---|---|---|
| Desk.dc.html | ede4e90a474e | 47 | 40 | 13 | 34 | 28 | 162 |
| scene1/Scene1.dc.html | f9d69355534c | 25 | 6 | 0 | 3 | 1 | 35 |
| scene3/Main.dc.html | 2f1123eb8f2a | 48 | 27 | 13 | 14 | 17 | 119 |
| 합계 | | | | | | | 316 |

Scene1은 누를 것이 시안에 없어(`onClick`·`setState` 0개) 표 3이 "(없음)"이다. 이는 시안의 실제 모습이다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/design/inventory.ts` (새) | 추출·출력·병합 스크립트. 정규식 + 괄호 짝 맞추기(문자열 건너뜀). 핸들러 이름을 정의(`name: () =>`, `name() {`)에서 찾아 `setState({...})` 키와 `this.x()` 호출(2단계)까지 따라간다 |
| `tests/unit/design-inventory.test.ts` (새) | 작은 가짜 시안으로 표마다 1행 이상, 키 추출, 같은 시안 → 같은 출력, 채운 칸 유지(파이프 포함·시안이 바뀌어도), 사라진 행 보존 |
| `reports/design-match/inventory.md` (새, 스크립트 출력) | 위 행 수. 맨 위에 만든 시각·해시·행 수 |

## 표 구성 메모
- 모든 표 열: 값 | 횟수 | 첫 자리(L줄 요소/클래스) | 내용 | 상태 | 근거. 행 키 = 파일 + 표 번호 + 값. 행은 키 순 정렬.
- 색: #hex·rgba·그라디언트. 그라디언트 안쪽 색은 따로도 센다. `#1029`처럼 숫자만 4자리인 것은 주문 번호로 보고 제외.
- 모션: `@keyframes`(본문), `animation*`, `transition*`, `setTimeout`/`setInterval`/`this.later(fn, ms)`(ms와 근처 코드 한 줄), `:hover`·`:focus`·`:focus-visible`·`:focus-within` 규칙은 이 표에 같이 있다.
- 누를 것: `onClick`·`onChange` 등 → 결과 `setState` 키와 호출한 메서드. 정의를 못 찾으면 "(정의 못 찾음)" (예: Desk `l.act`는 데이터 안의 값이라 정의가 없다).
- 접힘: `sc-if` 조건, `aria-expanded`, `*Open` 상태, more/less 이름, `rotate()`.
- 조건부 스타일: 색·스타일·클래스 토글이 들어간 삼항식 원문, `riskCol` 같은 색 함수.
- 시안에서 사라졌지만 채운 값이 있던 행은 파일 끝 "사라진 행" 절에 남긴다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npx vitest run tests/unit/design-inventory.test.ts | 5 | 0 | |
| npm test | 2348 | 0 | 66 파일 |
| npm run test:acceptance | 177 | 0 | 9 skipped (기존) |
| npx tsc --noEmit | - | 0 | 오류 없음 |
| npm run lint | - | 0 | 경고·오류 없음 |
| npm run build | 성공 | 0 | |

## 남은 문제
- 정규식 기반이라 완전하지 않다. 표 4의 more/less는 `.less`·`less` 등 이름이 겹쳐 잡음이 조금 있고, 표 5의 `첫 자리`는 JS 안에서 가장 가까운 키 이름이다 (줄 번호가 정확한 위치다). 빠진 행은 없는지(재현율)를 우선해 넓게 잡았다.
- 시안 파일은 읽기만 했다. `.env`·AI·PayPal·개발 서버는 쓰지 않았다.

## 컨트롤 타워에 요청할 결정
- 없음
