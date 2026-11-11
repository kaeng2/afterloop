# T078 보고 (2026-11-11 21:00)

- 기준 SPEC: v2.11 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ops / (커밋 후 `git log -1`로 확인 — 이 보고서와 같은 커밋)

## 결과
완료. `/intro` 경로(첫 장면 껍데기 화면)를 새 파일만으로 만들었다. 서버·PayPal·엔진·AI를 부르지 않고, 숫자는 시안의 고정 데모 값이다. 스크린샷은 찍지 않았다 (개발 서버를 띄우지 않는 조건).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/intro/page.tsx` | 서버 페이지 (정적, 메타데이터만) |
| `src/app/intro/intro-screen.tsx` | 클라이언트 화면. 언어 상태(EN/KO)만 가진다 |
| `src/app/intro/intro.css` | 시안 배치·간격·카드 모양. 색 값은 변수 정의 줄에만, 강조색은 `--color-accent` |
| `config/intro.en.json`, `config/intro.ko.json` | 문구 + 고정 데모 값 + 출처 note |
| `tests/unit/app-intro.test.ts` | 8개 단위 테스트 |

## 동작
- 동작하는 버튼: DisputeLess 아이콘, "Handle all 2 with DisputeLess", "Respond →"(2곳), 말풍선의 "Open DisputeLess →" — 모두 `/?item=PP-R-GMS-10197661`. 그 밖의 버튼(탭 5, 알림, 도움말, 송금, 결제 요청, See all)은 `type="button"` + `aria-disabled`, 핸들러 없음.
- 언어 선택 EN/KO는 시안처럼 넣었다 (React 상태, 핸들러 2개).
- "PayPal"은 로고 자리에서 "Seller dashboard"로, 맨 위 검은 띠 "Demo mock — not a real PayPal page"(문구 파일). 시안의 "PayPal balance"는 "Balance"로. PayPal 파랑 없음. 시안의 box-shadow는 기존 디자인 검사(그림자는 `--shadow-selected`만)에 맞춰 제거, 아이콘 맥박은 테두리 애니메이션으로 바꿨다.
- 분쟁: 서연 `PP-R-GMS-10197661` · 마감 Nov 30, 지호 `PP-R-MBJ-10197650` · 마감 Nov 29 (DECISIONS 기록의 응답 기한이 UTC 11/29 23:45라 UTC 날짜 그대로 적었다 — 한국 시간으론 11/30). Lena 줄 삭제, Mike는 시안에 없음 → 남은 분쟁 2건이라 "Handle all 3"을 **"Handle all 2"**, "3 open"→"2 open", 배지·말풍선 숫자도 2로 맞췄다.
- 390 폭: 900px 이하에서 한 줄 배치, 말풍선은 흐름 안으로, 가로 넘침 방지용 `min-width:0`·줄바꿈. **브라우저에서 직접 확인하지 못했다.**

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2155 | 0 | 53 파일 |
| npx tsc --noEmit | 오류 0 | | |
| npm run lint | 오류 0 | | |
| npm run test:acceptance | 167 (9 skip) | 0 | |
| npm run build | 성공 | | `/intro` 3.85 kB |

## 남은 문제
- 루트 `layout.tsx`가 모든 경로에서 위쪽 막대를 그리고 `loadTodayForRequest()`를 부른다. `/intro`는 layout을 고치지 않으려고 **전체 화면 고정 덮개(`position:fixed; z-index:1000`)** 로 막대를 가린다. 그래서 화면 자체는 서버를 안 부르지만, 요청 때 layout이 Today 데이터를 읽는 것은 막지 못했다.
- 시안의 "mentions chargeback"(서연 줄·말풍선 문구)은 시안 문구를 그대로 옮겼다. 서연 실제 기록과 맞는지 확인이 필요하다.
- 스크린샷·390 폭 확인은 사람(또는 컨트롤 타워)이 해야 한다.

## 컨트롤 타워에 요청할 결정
- `/intro`를 layout 밖으로 빼려면 라우트 그룹 `(app)`/`(intro)`로 나누는 구조 변경(기존 화면 이동, ui 레인 충돌)이 필요하다. 지금은 덮개 방식으로 두었다 — 이 방식으로 충분한지, 나눌지 결정해 달라.
- 서연 줄의 "mentions chargeback" 문구 유지 여부.
