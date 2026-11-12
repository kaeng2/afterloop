# 비밀값 검사 (2026-11-12, 사람 결정 08:00 2번)

- 범위: 모든 브랜치·모든 커밋 (`git log --all -p`, 커밋 638개). gitleaks가 설치돼 있지 않아 같은 종류의 규칙(개인 키, Anthropic/OpenAI/AWS/GitHub/Slack/Render 키, PayPal 액세스 토큰 A21AA…, Bearer·Basic 값, `client_secret=`·`api_key=`·`access_token=`·`password=` 대입, PayPal 길이의 ID·Secret 모양)으로 추가된 줄을 검사했다. **값은 출력하지 않았다.**
- 스크립트: 컨트롤 타워 scratchpad `scan.py` (저장소 밖)

## 결과: 규칙에 걸린 곳 8건 — 모두 시험용 가짜 값 (실제 비밀값 0건)

| 규칙 | 파일 | 커밋 | 판단 (값은 가리고 확인) |
|---|---|---|---|
| assigned_secret | tests/unit/app-t064-activity.test.ts | f2153c7358 | 시험용 `…test…` 값, 가짜 토큰 `…fake…` |
| assigned_secret | tests/unit/ops-t070-cache.test.ts | e2da1783c3 | 시험용 `…test…` 값 3줄 |
| assigned_secret | tests/unit/ops-t070-gates.test.ts | e2da1783c3 | 시험용 `…test…` 값 |
| anthropic_key 모양 | tests/unit/llm.test.ts | 0a17220f80, 3f7043790a | `FAKE_KEY` 상수 |
| assigned_secret | reports/T001-impl.md | e653e2b8b8 | 잘못된 Secret 시험 명령 (`…test…` 값, 401 확인용) |
| assigned_secret | tasks/T001.md | 206e95d8af | 위와 같은 시험 명령 |
| assigned_secret | tests/unit/execute.test.ts | 5774813d50 | 가리기 시험용 `secret…token…` 값 |
| PayPal ID 모양 | package-lock.json | 9042049307 | npm `integrity: sha512-…` 해시 (비밀값 아님) |

## 함께 확인
- `.env`·`.env.local`·`*.env`: 모든 커밋에서 한 번도 커밋되지 않음 (`git log --all -- .env …` 결과 0)
- `data/ai-cache/llm-cache.json` (지금 + 과거 3개 판): 이메일·전화번호·통관번호(P+숫자)·구매자 이름(서연·지호 등) 0건. 이름·날짜는 자리표시자(⟦BUYER_NAME_1⟧ ⟦SELLER_NAME_1⟧ ⟦DATE_1⟧)로만 있음

## 남은 것
- 원하면 저장소 공개 전에 gitleaks(Homebrew)로 한 번 더 돌린다 — 설치는 사람 승인 뒤
