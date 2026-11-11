# T089 구현 보고 — 색을 시안 v4 그대로

- 기준 SPEC: v2.13 (시작 때 확인, 일치) / 브랜치 `lane/ui-color` / 모델 sonnet-5-5
- 결과: **완료**. 색 값·색 변수 연결만 바꿨다. 배치·문구·숫자·동작 무변경.

## 바꾼 파일
- `src/app/globals.css`: 토큰 교체·추가 (아래 표). 파일 머리 설명에서 "파랑 금지" 문구 정리.
- `src/app/_shared/shell.css`: AI 알약 → `--gradient-ai`
- `src/app/today/today.css`: 이번 주 카드 → `--gradient-week`
- `src/app/cases/view/case.css`: 위쪽 선 → `--gradient-ai-line`, 사건 요약 줄 → `--gradient-soft`, 고른 선택지 테두리·라디오·단계 번호 원 → `--color-navy-ink`
- `src/app/cases/reply/reply.css`: 위쪽 선 → `--gradient-ai-line`, Chargeback 알약 → `--color-navy-ink`, 손님 반응 막대 → `--color-bar-*`
- `src/app/intro/intro.css`: 자체 `--color-accent`를 남보라에서 #0066f5로, 포커스 링 rgba도 파랑으로 (이 화면은 밝은 화면 고정이라 globals 라이트 값의 복사본을 둠)
- 시험: `app-t067`(파랑 금지 → 남보라 없음 + 토큰 값 = 시안 값), `app-intro`(같은 변경, PayPal 글자 로고·Demo mock 띠 검사 유지), `app-shared-design`(PayPal 파랑 거리 검사 → 시안 값·대비 검사)

## 자리 → 토큰 → 값 (밝은 모드)
| 자리 | 토큰 | 값 |
|---|---|---|
| 로고 "Less"·링크·위험 %·곡선 점선·Best 알약 | `--color-accent` | #0066f5 |
| 남색 글자·꼬리표 글자·예방 막대·고른 상품 칩 | `--color-accent-deep` | #002991 |
| 고른 선택지 테두리·라디오·단계 번호 원·Chargeback 알약 | `--color-navy-ink` | #0a1b3d |
| 이번 주 카드 | `--gradient-week` | linear-gradient(150deg,#001c64 0%,#002991 55%,#0b48c4 100%) |
| AI 알약 | `--gradient-ai` | linear-gradient(120deg,#002991,#0066f5 60%,#60cdff) |
| 지금 대응 위쪽 선 | `--gradient-ai-line` | linear-gradient(90deg,#002991,#0066f5 60%,#60cdff) |
| 고른 목록 줄·꼬리표 | `--color-accent-soft` | #e3f3ff |
| 가장 옅은 바탕 | `--color-accent-pale` | #f5f9ff |
| 사건 요약 줄 | `--gradient-soft` | linear-gradient(120deg,#e3f3ff,#f5f9ff) |
| 반응 막대 기다림 / 환불 / 차지백 | `--color-bar-wait/refund/chargeback` | #0066f5 / #99c2ff / #c4321f |
| 옅은 버튼 바탕, 진한 바탕 위 작은 글자 | `--color-accent-tint`, `--color-on-accent-muted` | #c9e3ff |
| 빨강·회색·검정 | 기존 토큰 (이미 시안 값) | #c4321f #9e2414 #fbe7e4 #3f4144 #e4e6e9 #cfd3d8 #f6f7f9 #000000 등 |

남보라(#5b3cc4, #a996f0, 4a2499, 6a46d6 등)는 `src/app`에서 모두 제거. 시험이 색상각 250~300°·채도 있는 hex와 위 두 값을 검사한다.
못 한 것: `#E8796B`(연한 빨강)는 현재 화면에 쓰이는 자리가 없어 토큰을 만들지 않음. 시안 전체 색 중 서랍 등 시안에 없는 자리는 기존 중립 토큰 그대로.

## 다크 모드 (시안은 라이트만 있어 새로 정함, 보라 없음)
accent #60a5ff, soft #14283f, pale #101e30, tint #1f3a5c, deep #1a3fa8, strong #2a5fd6, night #0d2563, sky #60cdff, navy-ink #8fb4f5, 막대 #60a5ff/#3f6aa8/#f97066, 그라데이션은 같은 파랑 계열로 어둡게.

## 대비 (WCAG AA 기준 4.5:1, 큰 글자 3:1)
| 조합 | 대비 | 판정 |
|---|---|---|
| 흰 글자 / #0066f5 (버튼·Best 알약) | 4.98 | 통과 |
| 흰 글자 / #002991, #0a1b3d, #001c64, #0b48c4 | 12.2 / 17.0 / 15.6 / 7.7 | 통과 |
| #c9e3ff / #002991, #0b48c4 (카드 위 작은 글자) | 9.2 / 5.8 | 통과 |
| #002991 / #e3f3ff | 10.7 | 통과 |
| #0066f5 / 흰 바탕 | 4.98 | 통과 |
| #0066f5 / #e3f3ff (고른 줄 위 링크) | 4.39 | **작은 글자는 4.5 미만** (큰·굵은 글자는 통과) |
| #0066f5 / #f1efea (Today 목록 영역 위 링크) | 4.33 | **작은 글자는 4.5 미만** |
| 다크: #60a5ff / #111214, #1a1c1f, #14283f | 7.4 / 6.8 / 5.9 | 통과 |
| 다크: 흰 글자 / #60a5ff (다크의 accent 채운 칸) | 2.52 | **미달** — 기존 보라(#a996f0)도 비슷했다. 다크 accent 위 글자를 어두운 색으로 하려면 `--color-on-accent` 다크 값 조정이 필요 (지시서 범위 밖이라 두었음) |

#0066f5 값은 시안 그대로라 바꾸지 않았다. 4.5 미만 두 자리는 시안과 같은 값이다.

## 확인
- `npm test` 61 파일·2288 통과, `npx tsc --noEmit`·`npm run lint` 0, `npm run test:acceptance` 15 파일 통과(9 skipped는 기존), `npm run build` 성공.
- 개발 서버·실제 AI/PayPal 호출·`.env` 읽기 없음. 스크린샷은 찍지 않았다 (컨트롤 타워 확인).

## 컨트롤 타워에 요청할 결정
- 다크 모드 흰 글자/accent 대비 2.52 (위 표). 다크 모드를 데모에서 안 쓰면 무시해도 됨.
- `/listing`은 이 브랜치에 없어 건너뜀 (T087이 토큰을 따라가야 함. 새 토큰 이름은 위 표).
