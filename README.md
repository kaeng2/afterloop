# DisputeLess

**A post-purchase copilot for small sellers on PayPal who sell abroad.** When a buyer opens a dispute in a language the seller can't read, DisputeLess reads the case through the PayPal APIs, finds the cause, compares the expected loss of each move (refund, offer, reply), and drafts a reply in the buyer's language — with code, not AI, deciding the numbers, the dates and what may be sent. Before a dispute happens, it rehearses the stock that is left and shows which fixes cut likely losses.

- **Live demo:** https://disputeless.onrender.com (public mode: real PayPal sandbox reads, cached AI, simulated sends)
- **What is real, what is assumed:** [honesty table](docs/submission/honesty-table.md) — real PayPal sandbox vs demo data vs assumptions vs what AI does vs what code decides, and known limits
- PayPal AI Hackathon submission. Built with Next.js, TypeScript, AG Grid Community, deployed on Render.

## How to test

Standalone addresses on the [live demo](https://disputeless.onrender.com):

1. **`/demo/seller-dashboard`** — a demo seller dashboard (mock, not a real PayPal page) → click **Handle all 3 with DisputeLess** (or **Respond** on Seo-yeon's row) to reach **`/`**, the DisputeLess desk with three real PayPal sandbox disputes. The other rows' Respond links also open Seo-yeon's case; pick Ji-ho or Mike from the desk's list.
2. **`/demo/store/new-product`** (type it in the address bar) — the new-listing check that runs before you publish a product.

Public mode never writes to PayPal; sends are simulated. Details: [docs/submission/testing.md](docs/submission/testing.md).

**No login is needed.** To run it against your own PayPal sandbox instead: create a free app at developer.paypal.com, copy `.env.example` to `.env`, fill in `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (and `LLM_API_KEY` for uncached AI), then `npm install && npm run build && npm start`. See [Test credentials](docs/submission/testing.md#test-credentials).

License: [MIT](LICENSE).

---

## 개발 안내 (한국어)

판매자에게 들어온 PayPal 분쟁 1건을 바둑판처럼 놓고, 허용된 대응마다 기대 손실을 계산해 가장 손실이 적은 수를 추천한다. 판매자가 승인하면 그 수를 PayPal API(샌드박스)로 실행한다. PayPal AI Hackathon 제출작 (마감 KST 2026-11-13 05:00).

- 기준 문서: [SPEC.md](SPEC.md) · 계약: [src/types.ts](src/types.ts) · 결정 기록: [DECISIONS.md](DECISIONS.md) · 작업 보드: [TASKS.md](TASKS.md) · 세션 규칙: [CLAUDE.md](CLAUDE.md)

## 빠른 시작

```bash
npm ci
npm run test:acceptance   # 인수 테스트 (잠금)
npm test                  # 단위 + 통합
RUN_SANDBOX=1 npm run test:sandbox   # 실제 샌드박스 호출 (수동)
npm run dev
```

## 폴더

| 경로 | 내용 | 수정 |
|---|---|---|
| `SPEC.md`, `DECISIONS.md`, `TASKS.md`, `tasks/`, `HANDOFF.md` | 사양, 결정, 작업 보드, 작업 지시서, 이동 안내 | 컨트롤 타워 |
| `src/types.ts`, `tests/acceptance/` | 계약과 인수 테스트 (잠금) | 컨트롤 타워 + 사람 승인 |
| `config/` | 가정값, 정책 기준값, 화면 문구 | engine / ui 레인 |
| `src/engine/`, `src/paypal/`, `src/exec/`, `src/ai/`, `src/app/`, `seed/` | 레인별 구현 | 해당 레인 (SPEC 8장) |
| `inbox/` | 기획 변경 붙여넣기 | 사람 |
| `reports/` | 작업 보고 | 작업 세션 |
| `docs/VERIFY.md` | 검증 세션 프롬프트 | 컨트롤 타워 |

## 레인별 브랜치와 worktree

브랜치는 레인마다 하나: `lane/engine`, `lane/paypal`, `lane/ai`, `lane/ui`, `lane/data` (이미 만들어 둠). worktree는 작업을 배정할 때 만든다.

```bash
# 1) worktree 만들기 (afterloop/ 에서)
git worktree add ../afterloop-wt/engine lane/engine
cd ../afterloop-wt/engine && npm ci

# 2) (선택) 다른 레인 폴더도 막기: 이 worktree에만 적용되는 로컬 설정
cat > .claude/settings.local.json <<'EOF'
{ "permissions": { "deny": [
  "Edit(/src/paypal/**)", "Edit(/src/exec/**)", "Edit(/src/ai/**)", "Edit(/src/app/**)", "Edit(/seed/**)", "Edit(/config/copy.*.json)"
] } }
EOF

# 3) 작업 세션 시작: 반드시 worktree 안에서 시작해야 잠금 설정이 적용된다
claude   # 첫 메시지: "tasks/T004.md 를 읽고 작업해줘"
```

- 레인 작업이 끝나면 컨트롤 타워가 `main`에 합친다 ("T0xx 병합해줘").
  ```bash
  git switch main && git merge --no-ff lane/engine && npm run test:acceptance
  ```
- 다른 레인은 합쳐진 `main`을 받아서 이어 간다: `git -C ../afterloop-wt/paypal merge main`
- 다 쓴 worktree 정리: `git worktree remove ../afterloop-wt/engine`
- 브랜치만 쓰고 싶으면 worktree 대신 `git switch lane/<레인>`도 된다. 단, 한 폴더에서는 한 번에 한 세션만 작업한다.

## 운영 (컨트롤 타워)

컨트롤 타워는 상위 폴더 `paypal-hackathon/`에서 시작한 세션이다 ([CLAUDE.md](CLAUDE.md)). 기능 코드는 쓰지 않는다. 아래 요청을 받으면 이렇게 한다.

### "inbox 반영해줘"
1. `inbox/`의 새 파일을 읽는다.
2. SPEC에 미치는 변경을 정리하고 `SPEC.md` 버전을 올린다 (v1 → v2, 날짜·시각).
3. `DECISIONS.md`에 결정·이유·영향받은 작업을 기록한다.
4. 영향받는 작업을 표로 보고한다 (작업 ID, 지금 상태, 바뀌는 점, 진행 중이면 멈춰야 하는지).
5. 필요한 작업 지시서를 수정·추가하고 `TASKS.md`의 기준 SPEC 열을 갱신한다.
6. 인수 테스트 기대값이나 계약(`src/types.ts`)이 바뀌어야 하면 **바꾸기 전에** 사람에게 승인을 요청한다.
7. 반영한 inbox 파일을 `inbox/done/`으로 옮긴다.

### "작업 쪼개줘 (기능명)"
1. 기능을 2시간 이내 단위로 나눈다. 레인 하나, 수정 가능 폴더가 겹치지 않게.
2. 작업마다 `tasks/T0xx.md`를 `tasks/_TEMPLATE.md` 형식으로 만든다 (기준 SPEC, 완료 기준 AC ID 포함).
3. `TASKS.md`에 추가하고 의존 관계를 적는다. 완료 기준 AC가 없으면 새 AC를 작성해 승인 요청한다.

### "T0xx 병합해줘"
1. `reports/T0xx-*.md`를 읽는다. 기준 SPEC이 현재와 같은지, 바뀐 파일이 지시서의 수정 가능 폴더 안인지 확인한다.
2. `git diff main..lane/<레인> -- src/types.ts tests/acceptance/ SPEC.md`가 비어 있는지 확인한다.
3. `main`에 병합한다 (`--no-ff`).
4. `npm run test:acceptance`, `npm test`, `npx tsc --noEmit`을 실행한다.
5. 결과에 따라 `TASKS.md` 상태를 완료/검토로 바꾸고, 실패하면 되돌리거나 후속 작업을 만든다.

### "상태 보고"
- `TASKS.md` 상태별 개수와 진행 중 작업
- 막힌 작업과 이유 (의존, 승인 대기, SPEC 불일치)
- 새로 들어온 `reports/`와 `inbox/`
- 오늘 남은 순서 (의존 관계 기준으로 다음에 시작할 작업)

## 정직성 표

정직성 표(실제 PayPal 샌드박스 · 데모 데이터 · 가정값 · 시뮬레이션 · AI가 하는 일 · 코드가 정하는 일 · 알려진 한계)는 [docs/submission/honesty-table.md](docs/submission/honesty-table.md) 한 곳에 둔다. 가정값의 정본은 [config/params.json](config/params.json), [config/reply-model.json](config/reply-model.json), [config/listing-model.json](config/listing-model.json)이다.
