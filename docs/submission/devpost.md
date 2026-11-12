<!-- Devpost 소개글 (영어, 최종본). 기준: DECISIONS 2026-11-13 00:20·00:25, SPEC v2.16, reports/T119-impl.md. 화면 문구·숫자는 고정 빌드(로컬 public 모드)에서 다시 확인했고, 식의 값은 src/engine/oracle.ts·recommend.ts로 다시 계산했다. 본문의 달러는 Devpost LaTeX 때문에 \$로 쓴다. [확인 필요]는 녹화 뒤 사람이 채운다. 양식 칸별 답은 devpost-form.md. -->

# DisputeLess

**PayPal data alone says refund. One carrier event changes the answer.**

Seo-yeon, a buyer in Korea, writes in Korean that her \$72 sweater never came and that she will go to her card company. On PayPal data alone, the safe move for the seller is a full refund: \$74, counting her time. A carrier record shows the parcel is held at Korean customs, waiting for one customs ID, so DisputeLess's code switches the answer to a reply with an expected loss of about \$37. While the seller writes that reply, a live forecast shows how her words move the chargeback risk: 95% for a rushed reply, 40% for the checked AI draft.

*The carrier record is demo data. The dispute, its Korean text and every read are real PayPal sandbox data. The forecast weights are our assumptions.*

**Try it:** https://disputeless.onrender.com/demo/seller-dashboard (no login; public mode: real sandbox reads, cached AI, simulated sends). **Code:** https://github.com/kaeng2/afterloop

## Inspiration

A dispute costs a small seller more than the order: a US PayPal seller pays a \$15 Standard Dispute Fee on a lost case, and Chargebacks911 estimates that merchants lose more than four dollars for every dollar disputed (a merchant survey estimate). The buyer loses too: Seo-yeon has waited three weeks for her parcel and still has no answer she can read. The seller can lose the customer as well: 57.4% of shoppers in Sendcloud's survey of eight European countries say they won't buy again from a retailer after a parcel never arrives. We wanted a tool for the window before a dispute becomes a chargeback: one that tells the seller *why* it is happening and gives the buyer a real answer in their own language.

Sources: [Chargebacks911](https://chargebacks911.com/consumer-pricing/), [PayPal US merchant fees](https://www.paypal.com/us/business/paypal-business-fees), [Sendcloud, 2025](https://www.sendcloud.com/how-delivery-frustrations-impact-repeat-purchases/).

## What it does

DisputeLess is a post-purchase copilot for small sellers on PayPal, shown through one morning of a fictional seller, Hannah Cole of Fernwood Knits.

1. **The dashboard.** `/demo/seller-dashboard` is a mock seller dashboard, marked "Demo mock — not a real PayPal page", with three real sandbox disputes in its Resolution Center. **Handle all 3 with DisputeLess** opens the DisputeLess desk.
2. **Seo-yeon (#1042, item not received).** The case opens with an empty reply and a no-reply forecast: dispute risk 91% if no reply by Nov 14. Her Korean messages sit next to an AI translation, and "AI read" flags the chargeback threat and the angry tone.
3. **✦ AI Respond now.** Turning on the switch shows the three options the engine compared: "Reply with the facts" (Best, chargeback 40%, cost ~\$37), "Offer a partial refund" (not offered for this case type, by policy) and "Refund in full" (cost ~\$74). The AI draft then types itself in, with check chips: apology, why it's held, next step for the buyer, a date, buyer's language.
4. **The forecast moves as she edits.** **Try a rushed reply** shows chargeback 95% and expected cost \$85, with chips that point at the blaming line and the vague timing. **Use AI draft** brings it back to 40% and \$37. **Details** shows "PayPal data only: Full refund \$74", the back-translation, and the code checks: facts match, no new promises, follow-up date.
5. **Send, then "What happens next · Simulated".** After **Send**, the desk shows the expected steps, each labeled Simulated: Seo-yeon replies with her customs ID, Hannah approves **Forward to carrier**, customs releases the parcel. The case moves to **Done today**.
6. **Ji-ho (#1038, not as described).** Her Korean message says a sleeve unraveled after a few hand washes, 5 weeks after purchase and past the 30-day return window. The card offers a free repair with her paying shipping ("Keeps ≈\$34"), and "How AI handled this" lists the steps: read, classify as B3 quality, compare the repair (≈\$16 for you) with a full refund (\$50), write the Korean reply. "On approval" names the one call it makes: `POST /v1/customer/disputes/{id}/send-message` (the case is now under PayPal review, so this step is simulated in the demo).
7. **Prevent and questions.** The Missing tracking card adds tracking to the 2 real sandbox orders without it (**Add all 2**; the "5 orders" count is demo data). Lena (#1029, asking in German about a promised \$24 refund that never came) and Yuki (#1051, a size question the AI answered) are demo cases with Simulated buttons. Mike's real sandbox dispute is flagged as a third "not received" claim in 90 days with a delivery record (that history is demo data), so DisputeLess does not act on it.
8. **All products.** Five summary cards (open cases, reply needed, prevent, questions, average dispute risk) sit above two AG Grid tables, "Products" and "Cases by risk", sorted by risk. Click a column to sort, or a row to open the case.
9. **New-listing check.** `/demo/store/new-product` is a demo store's "Add a product" form. **Publish product** first runs our check: a 4.5% chance of a dispute per order and \$770 expected loss, over 500 simulated sale periods. **See details and fix** lets AI insert text for six gaps, with `[__]` blanks for her real details, and **Recalculate** shows 2.1% and \$327.
10. **PayPal activity.** A drawer lists every PayPal call with method, path and response code. On the public link, writes show "Simulated · not sent".

**AI writes, code decides.** AI translates, drafts and back-translates replies, writes check chips and listing text, and judges tone. Code decides the cause, the expected loss of each move, the risk % and reply forecast, the follow-up date, and whether a message may be sent. Dates, amounts and names reach the AI only as tokens such as `⟦DATE_1⟧`, and code fills them in.

## How we built it

**DisputeLess calls the PayPal sandbox APIs directly; AI writes the words, and a deterministic engine decides the numbers.**

**PayPal sandbox APIs we actually called** (each succeeded in the sandbox):
- OAuth 2.0 token and Orders v2 create and capture for 14 sandbox orders. Ji-ho's new order was captured with 201 and status COMPLETED.
- Orders v2 read (`GET /v2/checkout/orders/{id}`) to check which orders have tracking.
- Disputes list and detail (`GET /v1/customer/disputes`, `GET /v1/customer/disputes/{id}`) for the 3 demo disputes. Ji-ho's `PP-R-ZOK-10200237` reads as NOT_AS_DESCRIBED, UNDER_PAYPAL_REVIEW, \$48.
- Disputes `send-message`, tested in Korean and English on a practice dispute (200); the Seo-yeon send is made on camera. [확인 필요: 녹화 후 실제 전송 결과(200)와 분쟁 번호]
- Disputes `make-offer`, a \$10.80 partial-refund offer on a practice dispute (200).
- Orders tracking `POST /v2/checkout/orders/{id}/track` (201 on a test order). [확인 필요: 녹화에서 O05·O07 등록 201]
- Transaction Search `GET /v1/reporting/transactions` returned 200 in our sandbox setup check and is implemented in `src/paypal/transactions.ts`, but no current screen calls it.

**AI.** `claude-opus-5-5`, called only from the server through the Anthropic SDK. Every output is checked against a zod schema and treated as untrusted input. Facts travel as tokens, and code blocks any draft that adds a refund, reship or discount promise the seller's policy does not allow.

**The engine.** For each case, code compares the expected loss of each move. A is the order amount, f the \$15 PayPal Standard dispute fee (charged only when the seller loses), t \$2 of seller time, p the chance of winning, q = 0.72 the offer acceptance rate at x = 15%, r = 0.8 the repair acceptance rate and R = \$7 the repair cost. All values except the fee are our assumptions.

$$
\begin{aligned}
L_{\text{refund}} &= A + t \\
L_{\text{fight}} &= (1-p)(A+f) + t \\
L_{\text{offer}} &= q\,xA + (1-q)(1-p)(A+f) + t \\
L_{\text{repair}} &= r\,R + (1-r)(1-p)(A+f) + t
\end{aligned}
$$

Seo-yeon (\$72, not received):

$$
\begin{aligned}
\text{PayPal data only } (p = 0.15):&\quad L_{\text{fight}} = 0.85 \times \$87 + \$2 = \$75.95, \qquad L_{\text{refund}} = \$72 + \$2 = \$74 \\
\text{with the carrier record } (p = 0.60):&\quad L_{\text{reply}} = 0.40 \times \$87 + \$2 = \$36.80 \\
L_{\text{reply}} < L_{\text{refund}} \iff&\quad p > 1 - \tfrac{72}{87} \approx 0.17
\end{aligned}
$$

Ji-ho (\$48, quality, p = 0.30):

$$
L_{\text{repair}} = 0.8 \times \$7 + 0.2 \times 0.7 \times \$63 + \$2 = \$16.42, \qquad L_{\text{refund}} = \$50, \qquad \text{Keeps} \approx \$50 - \$16.42 \approx \$34
$$

Without the carrier record, a refund wins by \$1.95. With it, a reply wins whenever the win chance is above about 17%, and we assume 60%, so the answer holds even if our guess is far off. Acceptance tests lock these values (for example, AC35 fixes Ji-ho's repair at 1,642 cents), and the same input always gives the same result.

**Simulation.** The new-listing check runs 500 seeded sale periods. "As-is" and "with fixes" use the same random numbers, so the difference comes from the fixes, not luck.

**Stack.** Next.js 15, React 19, TypeScript, zod, the Anthropic SDK, AG Grid Community for the two All products tables, and Render for the public demo (one web service from `render.yaml`).

**What is real and what is not.** Sandbox orders, the 3 demo disputes (including the buyers' Korean text), reads, sends and tracking are real PayPal sandbox (on the public link, sends and tracking are Simulated; real sends happen only in the recording setup). Carrier events, earlier inquiries, Lena and Yuki, order numbers like #1042, and due dates are demo data. Rates, win chances, the reply forecast and the listing-check weights are our assumptions (full table: [honesty-table.md](https://github.com/kaeng2/afterloop/blob/main/docs/submission/honesty-table.md)).

## Challenges we ran into

- **Bulk tracking was blocked.** PayPal's `trackers-batch` returned 403 in our app, and PayPal's docs mark it as legacy. We add tracking order by order with `/v2/checkout/orders/{id}/track`.
- **Tracked "not received" disputes went to review.** Disputes filed on orders that had tracking moved to PayPal review within minutes, where messages and offers are not available. We re-filed Seo-yeon's dispute on an order without tracking, and the app never adds tracking to an order with an open dispute. Ji-ho's new dispute is also under PayPal review with no seller due date in the API, so her "Reply by Dec 2" is demo data.
- **A message closes the offer.** Once a seller sends a message, PayPal removes the make-offer link until the buyer replies. So when an offer is the best move, DisputeLess sends the offer first and puts the explanation in its note.
- **Longer complaint texts.** PayPal asked for at least 120 characters when we filed the buyers' complaints, so the screen shows the real, longer texts instead of our design drafts.
- **AI changed what a date meant.** In one run the follow-up date meant "delivery by this day", in another "reship if it doesn't arrive". Now code computes the date, the prompt says what it means (the day the seller checks and writes back), and code checks every draft.

## Accomplishments that we're proud of

- A case where one piece of data changes the answer, shown with real PayPal dispute data and the engine's math.
- A reply forecast that moves while the seller types, from 91% with no reply to 40% with the checked draft.
- A clear line between what AI writes and what code decides, enforced by checks, not by trust.
- Every PayPal call listed in a drawer, and every non-real item labeled Demo data, Assumption or Simulated.

## What we learned

- **PayPal's dispute state decides what a seller can do.** The links in each dispute (send-message, make-offer, accept-claim) change after every action, so the app reads them instead of guessing.
- **One fact can matter more than a better model.** The carrier record turned a \$75.95 versus \$74 coin flip into a clear answer.
- **AI is safest away from numbers.** With tokens for facts and code checks on every draft, the AI can write freely without inventing dates or amounts.
- **Labels make a demo easier to trust.** Marking each item Real, Demo data, Assumption or Simulated also kept our own claims honest.

## Testing instructions

**No login is needed. Open https://disputeless.onrender.com/demo/seller-dashboard and follow three steps** (the first load can take a few seconds while the free server wakes up).

1. **Reply to Seo-yeon.** Click **Handle all 3 with DisputeLess**. Turn on **✦ AI Respond now**. Click **Try a rushed reply** and wait until the typing stops (95%). Click **Use AI draft** and wait about 16 seconds until the typing stops (40%). Open **Details**, and click **Send**. Watch "What happens next · Simulated" and click **Forward to carrier**.
2. **See the other cases.** Click the **Knit Cardigan** product chip to open Ji-ho's card (#1038, "Keeps ≈\$34", "How AI handled this"). Click **All products** for the two AG Grid tables, then **PayPal activity** (top right) for the call log.
3. **Check a new listing.** Type `/demo/store/new-product` in the address bar. Click **Publish product** (4.5%), then **See details and fix**. Click all six **Insert** buttons, then **Recalculate** (2.1%).

Public mode makes real sandbox reads; Send, Send offer, Add all, Refund, Looks good and Forward are **Simulated** (zero PayPal writes). AI answers for the demo cases are cached, and uncached AI calls have an hourly cap. We don't share the sandbox login, because a shared login could change the demo disputes; to use your own sandbox, see [testing.md](https://github.com/kaeng2/afterloop/blob/main/docs/submission/testing.md).

## What's next for DisputeLess

- A recurrence report: group closed disputes by cause, product and country, and feed them into next month's listing check.
- Real carrier integration and carrier comparison.
- A policy settings screen for what replies may promise.
- Calibrating rates from the seller's own dispute history through Transaction Search and the Disputes API.
