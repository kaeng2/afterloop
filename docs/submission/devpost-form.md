<!-- Devpost 제출 양식 칸별 최종 답 (영어). 기준: DECISIONS 2026-11-13 00:20 ②·00:25, devpost.md. 글자 수는 python len() (공백 포함). 해커톤 추가 질문의 정확한 문구는 이 저장소에 기록이 없어 칸 이름은 내용 기준으로 적었다 — 양식에서 문구를 확인하고 맞는 칸에 붙인다. -->

# Devpost form answers — DisputeLess

## Step 1 · Project overview

### Project name
Limit: not confirmed (Devpost shows a counter). Length: 11 characters.

```
DisputeLess
```

### Elevator pitch
Limit: 200 characters. Length: 186 characters.

```
PayPal data alone says refund. DisputeLess finds the real cause of a dispute, does the math in code, and helps small sellers reply in the buyer's language before it becomes a chargeback.
```

## Step 2 · Project details

### About the project
Paste `docs/submission/devpost.md` from the line "**PayPal data alone says refund. One carrier event changes the answer.**" to the end (leave out the HTML comment and the `# DisputeLess` title, because Devpost shows the project name). Markdown and LaTeX: every dollar amount in body text is written `\$`; the three formula blocks use `$$ … $$`. Length: 13879 characters (no limit known).

Before pasting, fill or delete the two recording markers in "How we built it":
- `[확인 필요: 녹화 후 실제 전송 결과(200)와 분쟁 번호]`
- `[확인 필요: 녹화에서 O05·O07 등록 201]`

### Built with
```
next.js, react, typescript, zod, paypal-orders-api, paypal-disputes-api, paypal-sandbox, anthropic-claude, claude-code, ag-grid, render, vitest, playwright
```

### "Try it out" links
```
https://disputeless.onrender.com/demo/seller-dashboard
https://github.com/kaeng2/afterloop
```

### Video demo link
[확인 필요: 녹화 영상 YouTube/Vimeo 링크]

### Image gallery
Five 3:2 PNG images, 1500×1000, ≤5 MB each, from the public deployment: `docs/submission/images/01`–`05`, thumbnail = image 02.

## Step 3 · Additional info (hackathon questions)

### Testing instructions
Length: 1420 characters.

```
No login is needed. Open https://disputeless.onrender.com/demo/seller-dashboard (the first load can take a few seconds while the free Render server wakes up).

1. Reply to Seo-yeon. Click "Handle all 3 with DisputeLess". Turn on "✦ AI Respond now". Click "Try a rushed reply" and wait until the typing stops (95%). Click "Use AI draft" and wait about 16 seconds until the typing stops (40%). Open "Details", and click "Send". Watch "What happens next · Simulated" and click "Forward to carrier".
2. See the other cases. Click the "Knit Cardigan" product chip to open Ji-ho's card (#1038, "Keeps ≈$34", "How AI handled this"; the case is now under PayPal review, so its send-message step is simulated in the demo). Click "All products" for the two AG Grid tables, then "PayPal activity" (top right) for the call log.
3. Check a new listing. Type /demo/store/new-product in the address bar. Click "Publish product" (4.5%), then "See details and fix". Click all six "Insert" buttons, then "Recalculate" (2.1%).

Public mode makes real PayPal sandbox reads. Send, Send offer, Add all, Refund, Looks good and Forward are Simulated (zero PayPal writes). AI answers for the demo cases are cached; uncached AI calls have an hourly cap. We don't share the sandbox login, because a shared login could change the demo disputes. To run it on your own sandbox: https://github.com/kaeng2/afterloop/blob/main/docs/submission/testing.md
```

### Code repository
```
https://github.com/kaeng2/afterloop
```

### PayPal APIs used
Length: 1022 characters.

```
All calls go to the PayPal sandbox (api-m.sandbox.paypal.com) from our server.
- OAuth 2.0: POST /v1/oauth2/token
- Orders v2: create and capture for 14 sandbox orders (Ji-ho's new order: capture 201, COMPLETED); GET /v2/checkout/orders/{id} to see which orders have tracking
- Disputes: GET /v1/customer/disputes and GET /v1/customer/disputes/{id} for the 3 demo disputes (Ji-ho's PP-R-ZOK-10200237: NOT_AS_DESCRIBED, UNDER_PAYPAL_REVIEW, $48)
- Disputes: POST /v1/customer/disputes/{id}/send-message (200, Korean and English, practice dispute; Seo-yeon send on camera)
- Disputes: POST /v1/customer/disputes/{id}/make-offer (200, $10.80 partial-refund offer, practice dispute)
- Order tracking: POST /v2/checkout/orders/{id}/track (201, test order)
- Transaction Search: GET /v1/reporting/transactions (200 in our setup check; implemented, but no current screen calls it)
Every call appears in the app's "PayPal activity" drawer with method, path and response code. On the public link, writes are Simulated and not sent.
```

### AI tools used
Length: 801 characters.

```
In the product: Claude (claude-opus-5-5) through the Anthropic SDK, called only from our server. It translates buyer messages, drafts and back-translates replies, writes check chips and listing text, judges tone, classifies cases no rule covers, and summarizes case history. Output is validated with zod and treated as untrusted; dates, amounts and names reach it only as tokens that code fills in. Code, not AI, decides every number, date and whether a message may be sent.

To build it: Claude Code (Claude Opus 5.5 for the engine and screens, Claude Sonnet 5.5 for independent verification and simple scripts, Claude Haiku for status notes), with Playwright scripts to compare the app against the design mockups. Mockups were made in a visual design tool and exported as HTML. We did not use Figma.
```

[확인 필요: 디자인 시안 도구 이름 — docs/design/mockup-v*/README.md는 "a visual design tool"이라고만 적혀 있다. 이름을 알면 위 "a visual design tool" 자리에 넣는다.]

### Sponsor tools used
Length: 356 characters.

```
AG Grid Community: the two tables on the All products overview, "Products" and "Cases by risk" (sortable columns, click a row to open the case, risk bar cells, "N rows · Sorted by …" footer).
Render: hosts the public demo, https://disputeless.onrender.com, as one Node web service defined in render.yaml (free plan, public demo mode with simulated writes).
```

### PayPal integration (self-assessment)
Length: 1172 characters.

```
8/10.
What works with real sandbox calls: 14 orders created and captured, 3 live demo disputes read (list and detail), send-message (200, Korean and English), make-offer (200), per-order tracking (201), and a drawer that shows every call with its response code. The engine reads each dispute's state and links to decide what can be sent.
Why not 10, from what we hit:
- trackers-batch returned 403 in our app (and is marked legacy), so we add tracking order by order.
- "Not received" disputes on tracked orders moved to PayPal review within minutes, with no message or offer links; we re-filed Seo-yeon's case on an untracked order. Ji-ho's quality dispute is also under PayPal review with no seller due date, so the due date on screen is demo data.
- After a seller message, PayPal removes make-offer until the buyer replies, so we send the offer first.
- Buyer complaints needed at least 120 characters when filed.
- Created orders expire about 3 hours after creation (PayPal docs), so we re-created them right before buyer approval.
- Transaction Search is implemented but no screen calls it yet, carrier events are demo data, and the public link simulates all writes.
```

Where each blocker is documented in the repo (for us, not for the form):
- trackers-batch 403 → `DECISIONS.md` 2026-11-09 v1.1 (T011 tracking row)
- Tracked "not received" disputes moved to review in 8–17 minutes → `DECISIONS.md` 2026-11-10 v2.2 "Q14-B 결과"; Ji-ho's dispute UNDER_PAYPAL_REVIEW, no seller due date → `reports/T119-impl.md` "재시도(분쟁 확인)"
- Message removes make-offer until the buyer replies → `DECISIONS.md` 2026-11-10 v2.5 "연습용 분쟁에서 배운 것" and v2.5 → v2.6 "제안이 먼저"
- 120-character complaint minimum → `DECISIONS.md` 2026-11-10 v2.2 "서연 분쟁 문장 변경"
- Orders expire about 3 hours after creation, orders re-created before approval → `DECISIONS.md` 2026-11-09 v2.2 "주문 만료 주의" (PayPal docs, not tested by us) and `reports/sandbox-approve-links.md` (re-created 2026-11-10 07:41 KST)
- Transaction Search implemented but not called by a screen → `docs/submission/honesty-table.md`, `reports/review-20261112-3.md`

### Special prizes this project fits
Length: 312 characters.

```
Best Use of PayPal + AI: the PayPal Disputes and Orders APIs supply the facts and the actions; AI only writes and translates, and code decides the numbers and what may be sent.
Most Impactful: the buyer gets a clear answer in her own language and a path to her parcel, instead of a silent seller or a chargeback.
```

---

About 칸은 붙여 넣은 뒤 Devpost 미리보기로 수식·금액이 제대로 보이는지 확인
