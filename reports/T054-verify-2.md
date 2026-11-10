판정: 통과

# T054 재검증 (2차)

대상: lane/ai 최신 커밋 6867667 (기준 main). .env 열람·실제 AI 호출 없음. 코드·테스트 수정 없음.

## 범위
`git diff main...HEAD --stat`: reports/T054-impl.md, src/ai/commitments.ts, tests/unit/commitments.test.ts 3개뿐. 범위 밖 변경 없음.

## 실행 (종료 코드)
| 명령 | 결과 | 종료 코드 |
|---|---|---|
| npm test | 27 파일, 1450 통과, 실패 0 | 0 |
| npx tsc --noEmit | 출력 0바이트 | 0 |
| npm run lint | 오류 없음 | 0 |
| npm run test:acceptance | 155 통과, 9 skipped, 실패 0 | 0 |

## 성능 (en/ko/ja/de 중 최댓값, ms)
지정 17개 입력 + 추가 24개(공백 반복 뒤 send/send you/send it out, 新しい 반복·新しい+あ 반복, free return·cover the·pay for the·at no·shipping is on 반복, `1.`*N/2+`5 percent off`, `$ ` 반복, `돌려 드리` 반복, another one 반복, schick 뒤 공백, `. `·`\n`·`{{`·`⟦` 반복 등). 한도: 2만 자 100ms, 20만 자 1000ms. 한도 초과 0건.
| 입력 | 2만 자 | 20만 자 |
|---|---|---|
| '1'*N+' percent' (1차 실패 입력) | 2.7 | 1.3 |
| '1'*N+' percent off' | 0.1 | 0.7 |
| '1.'*N/2+' percent' | 1.3 | 5.0 |
| '1 '*N/2 | 0.1 | 1.2 |
| ' '*N+'off' | 0.5 | 5.2 |
| '$'+'1'*N | 0.1 | 1.3 |
| '$1'*N/2+' off' | 0.4 | 1.5 |
| 'send '*N/5 | 0.3 | 3.7 |
| 'a new '*N/6 | 0.2 | 1.7 |
| 'send a new '*N/11 | 0.2 | 2.1 |
| 'schick '*N/7 | 0.3 | 1.6 |
| '돌려 '*N/3 | 3.9 | 2.1 |
| '보내 '*N/3 | 0.2 | 2.1 |
| 'new '*N/4+'x' | 0.1 | 1.0 |
| '% '*N/2 | 0.1 | 1.3 |
| 'free '*N/5 | 0.3 | 2.7 |
| 'again '*N/6 | 0.2 | 1.5 |
| 추가 24개 중 최악 | 1.3 (`. `*N/2, de) | 5.7 (send+공백, de) |
20만 자도 최대 6ms. 2만 자 대비 약 10배로 선형이다 (1차: 20만 자 40초).

## 정규식 점검
`PATTERNS`는 모두 `{n,m}` 상한 반복(`\s{1,4}`, `\d{1,9}`, `.{0,20}`, `[a-z]{0,3}`)과 고정 낱말이다. 겹친 반복 `(a+)+`, 상한 없는 반복 뒤 선택 요소, `.*`·`[^.]*` 이중 사용 없음. percent off는 `(?<![\d.])`로 시작 위치를 제한해 이차가 사라졌다. `matcher`는 공백을 `\s{1,4}`로 바꾸고, `withoutPlaceholders`의 `⟦[^⟦⟧]*⟧`는 `⟦`가 N개여도 6ms였다(`⟦`마다 끝까지 훑지만 `⟦`가 `[^⟦⟧]`에서 제외돼 선형). `SENTENCE_PAIRS`는 문장 분할 후 문장당 정규식 2개로 선형이다. 의심 식마다 가장 괴롭히는 입력으로 20만 자를 재 모두 통과했다.

## 놓친 6개 + 지시서 표현
`$5 off`, `free return label`, `cover return shipping`, `전액 돌려 드릴게요`, `新しい商品をお送りします`, `Wir schicken Ihnen ein neues Paket` 모두 잡힘. 지시서 "고칠 것" 표현 전부(약 50개, 범주·언어별 샘플)도 잡힘, 누락 0.

## 잡히면 안 되는 것
지시서 목록 전부 + 서연 답장 3개(전문 3개와 지시서의 문장 3개)를 네 언어 모두로 돌려 빈 배열. 서연 답장은 통과.
새 낱말 확인: `return policy`, `please return the item`, `the return label you sent`, `shipping is delayed`, `a new tracking number`, `새 추적 링크를 보내 드릴게요`, `전액 결제 확인했습니다` 모두 빈 배열.

## 발견한 문제
- [기록만] `I will send you a new tracking link`가 reship으로 잡힌다 (`send you a new` 패턴, 4개 언어 모두). "헷갈리면 잡는 쪽" 원칙에는 맞고, 판매자 확인으로 풀리지만 새 추적 링크를 약속하는 정상 초안이 확인을 받게 될 수 있다. 서연 답장 3개에는 없다.
- 그 외 병합 차단·병합 후 수정 항목 없음.

## 기존 테스트 기대값
`git diff main...HEAD -- tests/unit/commitments.test.ts`: 삭제 행 없음(추가만). 변경 없음.

## 구현 보고서 주장 대조
- tsc 0, lint 0, test 1450, acceptance 155 모두 사실로 확인(구현자가 못 봤다던 tsc도 종료 코드 0).
- 다른 사실은 일치. 사실과 다른 주장은 찾지 못했다. 테스트 개수(47·17·10)는 세지 않았다. 최상단 "결과" 절의 1440은 재시도 전 수치이고 재시도 절에 1450으로 갱신돼 있어 모순 아님.
