# T089 검증 보고 (7cb4e7c, 기준 6251a50)

판정: **실패** (연결 누락 1건 — #002991 남색이 어느 CSS에도 쓰이지 않음)

## 1. 명령
- npm test: 61 파일 중 storefront 시간 초과 1건(단독 재실행 31/31 통과), 나머지 2287 통과
- tsc --noEmit 0, lint 0, test:acceptance 15 파일 177 통과(9 skipped), build 성공

## 2. 남보라
src/app의 #5b3cc4·#a996f0·4a2499·6a46d6·f1edfc·e6e0fa·ddd5f7 등 grep 0건. hue 250~300 채도 있는 hex 스캔 0건. rgba(91,60,196) 제거(intro 포커스 링은 파랑으로).

## 3. 위치별 연결 대조
| 자리 | 클래스 → 변수 | 값 | 판정 |
|---|---|---|---|
| 링크·로고 Less·위험 %·곡선 점선(case.css 208 stroke)·Best 알약(case.css 667) | --color-accent | #0066f5 | OK |
| 이번 주 카드 | today.css:134 .weekly → --gradient-week | 150deg #001c64/#002991/#0b48c4 | OK |
| AI 알약 | shell.css:271 → --gradient-ai | 시안과 동일 | OK |
| Respond now 위쪽 선 | case.css:532, reply.css:256 → --gradient-ai-line | 90deg 시안 동일 | OK |
| 고른 선택지 테두리·라디오·단계 원·Chargeback 알약 | case.css 629/652/567, reply.css:76 → --color-navy-ink | #0a1b3d | OK |
| 연한 바탕 | 사건 요약 줄 --gradient-soft, 고른 줄 --color-accent-soft | #e3f3ff / 그라데이션 | OK |
| 반응 막대 3색 | reply.css 176/180/184 → --color-bar-wait/refund/chargeback | #0066f5/#99c2ff/#c4321f | OK |
| 빨강·회색·검정 | 기존 토큰(시험이 값 검사) | 시안 값 | OK |
| **예방 막대** | today.css:260 `.today-group-prevent .today-group-bar` → --color-accent | #0066f5 (시안은 #002991) | **누락** |
| **남색 글자·꼬리표 글자** | 해당 자리 var(--color-accent-deep) 사용 없음 (today-pill-* 는 pill 중립 토큰) | — | **누락** |
| **고른 상품 칩** | today.css:61-63 `.product-filter-chip[aria-current]` → accent-soft 바탕 + --color-accent 테두리·글자 | #0066f5 (시안 남색) | **누락** |
| Products 고른 줄 이름 | products.css:124 → --color-accent | #0066f5 | 확인 필요 |

`grep accent-deep src` → globals.css 정의만 있고 사용처 0. --color-accent-pale·accent-strong·accent-night도 단독 사용처 없음(그라데이션 안 리터럴로만). 즉 "#002991 남색" 기준이 토큰 값 시험(값만 확인)을 통과할 뿐 화면에 연결되지 않았다. 구현 보고서 표도 이 자리를 "--color-accent-deep"로 적었으나 실제 CSS에 쓰이지 않아 사실과 다르다.
(참고: 구현 보고서가 #E8796B 미사용, 대비 4.39/4.33·다크 2.52 미달을 밝힌 것은 정직하게 적혀 있음.)

## 4. 색만 변경
src diff 전부 색 값·변수 교체(주석 제외). 크기·간격·문구·숫자·동작 변경 0. 로고 그림·"PayPal" 글자 로고 추가 없음, intro "Seller dashboard"/Demo mock 띠 파일 미변경(시험 유지).

## 5. 시험 변경
app-t067: 파랑 금지 → 남보라(hue 250~300, sat>0.15 + 고정 문자열) 없음 + 토큰 값 시험(지시서대로). app-intro: 파랑 금지 → 남보라 검사, PayPal 글자 로고·Demo mock 검사 유지. app-shared-design: PayPal 파랑 거리 시험을 시안 값·대비 시험으로 교체(지시서의 "파랑 금지 시험" 교체 범위 내). 다른 시험 약화 없음. 다만 토큰 "값"만 보고 "사용처"를 보지 않아 위 누락을 못 잡음(시험 허점).

## 6. 범위
변경 파일은 src/app CSS, tests/unit 3개, reports뿐. 엔진·AI·PayPal·계약·인수 변경 0.

## 필요한 수정
예방 막대·고른 상품 칩(Today 필터 칩, 필요 시 Products 고른 줄)·남색 글자/꼬리표 글자 자리를 --color-accent-deep(#002991)에 연결하고, 사용처 시험을 추가할 것. 시안 Desk.dc.html에서 #002991 사용 자리(아이콘 stroke, aiRead 글자 등)와 대조.
