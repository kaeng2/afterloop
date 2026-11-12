# T108 보고 (2026-11-12)

- 기준 SPEC: v2.15 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / (커밋 직후 `git log -1` 참고)

## 결과
완료. 시안 `<style>` L16–L36을 `scene1.css`로 그대로 복사하고, 요소를 시안 클래스·인라인 style 값으로 바꿨다. 화면 루트 기본값을 시안 값으로 다시 정해 globals body 상속을 끊었다. 그림(픽셀) 비교는 하지 않았다 (컨트롤 타워 몫, 개발 서버 금지).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/intro/scene1.css` (새) | 시안 `<style>` 규칙·keyframes 그대로 + 줄 번호 주석. 선택자 앞에 `.intro` 범위만 붙임 (`.pp *`·`.pp a` → `.intro *`·`.intro a`, 나머지 `:where(.intro) …`로 시안 우선순위 유지). `body{margin:0}`만 뺌 (globals가 이미 0) |
| `src/app/intro/intro.css` | 옛 규칙 대부분 삭제. 남긴 것: 루트 기본값, Demo mock 띠, 언어 선택, button 탭·링크 모양, 좁은 폭 규칙, reduced-motion |
| `src/app/intro/intro-screen.tsx` | 시안 클래스(tab, card, btn, b-black, b-line, ico, al-icon, pulse, rise, row, chip, rlink) + 시안 인라인 style 값을 `style`로. 동작·데이터 경로·링크·문구 키 무변경 |
| `tests/unit/app-t108-intro.test.ts` (새) | 시안 블록 규칙이 scene1.css에 그대로 있는지, `.intro` 범위, 루트 기본값, 시안 클래스 사용 |
| `tests/unit/app-t098a-scenes.test.ts` | Scene 1 정적 시험을 옛 `--i-*` 변수·`intro-*` 클래스 대신 시안 규칙·클래스 기준으로 바꿈 (이유: 값 출처가 시안 파일 복사로 바뀜. 동작 시험 아님) |
| `tests/unit/app-shared-design.test.ts` | `src/app/intro/**`를 "색·그림자 변수 전용" 검사에서 제외 (시안 값을 그대로 복사하는 폴더라서. 다른 화면 검사는 그대로). /intro 그림자 변수 검사 항목 삭제 → app-t108 시험이 대신 봄 |
| `tests/unit/app-intro.test.ts`, `app-t079.test.ts` | 로고 span·루트 class 단언을 새 마크업에 맞춤 |

## 시안 클래스 ↔ 앱 요소 대응표
| 시안 | 앱 요소 |
|---|---|
| 루트 `.pp` 인라인(L46) | `.intro` 루트 (intro.css 기본값) |
| header 인라인(L47) | `header.intro-header` (인라인 style) |
| `.chip` Demo mock / 건수 | 브랜드 줄 칩, Resolution Center 탭 칩, RC 카드 "N open" 칩 |
| `.tab`, `.tab.on` | 상단 탭 5개 (`button.tab`) |
| `.al-icon.pulse` | DisputeLess 아이콘 링크 |
| `.ico` | 알림·도움말 버튼 |
| `.rise` (말풍선) | `div.rise.intro-coach` |
| `.btn` (흰 버튼 L66, 그라디언트 L104) | 말풍선 "Open DisputeLess →", RC 카드 "Handle all N" 링크 |
| `.btn.b-black` / `.b-line` | Transfer money / Request payment |
| `.card` | 잔액·Recent activity·RC·Sales 카드 4개 |
| `.row` | 활동 행, 분쟁 행 (`gridTemplateColumns` 인라인) |
| `.rlink` | "See all"(button), "Respond →"(Link) |
| 막대 span 인라인 | 매출 막대 14개 |

## 예외로 남긴 곳
1. 맨 위 Demo mock 띠(`.intro-band`), 로고 자리 "Seller dashboard" (22:15 결정).
2. 언어 선택 EN/한국어 (`.intro-lang`) — 시안에 없음 (T081 동작).
3. 탭·"See all"은 `<button aria-disabled>` (시안은 `<a href="#">`; 기존 시험이 "눌러도 아무 일 없음"을 고정). 시안 `.pp a{color:#0066F5}` 파랑을 `button.tab:not(.on)`·`button.rlink`에 같은 색으로 줌.
4. 좁은 폭(≤900px) 규칙 — 시안은 1440 한 장. 인라인 값을 `!important`로 덮음. 데스크톱 폭에는 영향 없음.
5. `h1` 색: globals `h1{color:heading}`을 막으려 `color:inherit` 인라인.
6. 숫자 `tabular-nums`·금액 클래스는 시안에 없어서 뺌 (시안 그대로).
7. 시안 `.ko`는 `.intro:lang(ko)` 루트 규칙(같은 글꼴 스택)으로 적용.
8. 글꼴 로드: 시안 `<link>` Google Fonts 대신 앱 layout의 next/font 변수 (루트 font-family는 시안 스택 이름 그대로, 폰트 파일은 같은 Figtree·Noto Sans KR).
9. 통관·약속·Lena 관련 데이터는 기존 config 값 그대로 (시안과 다른 데이터 자리).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2553 | 1 | `storefront.test.ts` "결정론 100회" 흔들림 — 단독 재실행 31/31 통과 |
| npx tsc --noEmit | 0 오류 | | |
| npm run lint | 0 오류 | | |
| npm run test:acceptance | 177 (9 skipped) | 0 | |
| npm run build | 성공 | | |

## 남은 문제
- `reports/design-match/inventory.md` /intro 행은 갱신하지 않음 (그림 비교 뒤 컨트롤 타워가 채우는 쪽이 정확).
- 픽셀 비교 안 함. 확인 포인트: 탭 파랑(시안이 `<a>`라 파란색), 말풍선 위치, 모바일 폭.

## 컨트롤 타워에 요청할 결정
- 없음 (단 `app-shared-design` 시험의 `intro/` 제외가 T107 등 다른 레인과 겹치면 병합 때 충돌 가능 — 같은 함수 `isMockupCopy`에 폴더를 추가하는 식으로 합치면 됨).
