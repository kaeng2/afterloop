<!-- 메모(한국어): 정직성 표 (README·Devpost가 이 파일을 가리킨다). 근거는 PRD v3 16장, SPEC v2.10, DECISIONS, config/params.json. 심사위원이 30초에 읽도록 짧게 줄임. 가정값 목록은 params.json·reply-model.json·listing-model.json의 source 기준. -->

# What is real, what is assumed

DisputeLess is a hackathon prototype on the **PayPal sandbox** with a **fictional seller** (Hannah Cole, Fernwood Knits). Every number on screen is an example, not a forecast.

| Column | What it covers |
|---|---|
| **Real (PayPal sandbox)** | 13 sandbox orders (Orders API, captured). 3 live demo disputes, including the buyer-filed Korean complaint text. Dispute list and detail reads. Messages sent in Korean and English (HTTP 200, tested on a practice dispute). A partial-refund offer via make-offer (HTTP 200, practice dispute). Per-order tracking via `POST /v2/checkout/orders/{id}/track` (201). Transaction Search `GET /v1/reporting/transactions` returned 200 in our sandbox setup check and is implemented in code, but **no current screen calls it**. |
| **Assumptions** | See the list below. Rates, win probabilities, and policy choices that we set ourselves. Marked with an Assumption badge in the app. |
| **Demo data** | Carrier tracking and customs events (for example "Oct 30 · Customs hold" on Seo-yeon's order). Pre-dispute inquiries (Seo-yeon's Nov 2 message, which drives the "no reply yet" signal). Mike's two earlier claims. 6 closed disputes and the order history behind the $413 loss total. Order dates on screen. Buyers outside the sandbox. Marked with a Demo data badge. |
| **Simulated** | Everything under "What happens next · Simulated" after a send: the buyer's reply, Forward to carrier, customs release and their Risk %. These are expected steps, not real events, and the path branches on the sent reply's forecast. Every write button on the public link (Send, Send offer, Add all) and Publish on the demo store. Marked Simulated. |
| **What AI does** | Translates the buyer's Korean message. Writes reply coaching, the short "reply covers" chips, and the English draft with a natural Korean version, then back-translates it. Judges an angry tone. Classifies cases that no rule covers. Summarizes a case's history. In the new-listing check, writes suggested listing text for six gaps, with `[__]` blanks for the seller's real details (no numbers from AI). Facts (dates, amounts, names) reach the AI only as tokens such as `⟦DATE_1⟧` and are filled in by code. |
| **What code decides** | The cause of a case (rule: a customs hold in the carrier record means "held at customs", with zero AI calls). Expected loss and the suggested move and amount. The follow-up date (send date + 7 days, pulled earlier if the PayPal response deadline comes sooner). The risk % (curve 80% → 40%) and the reply forecast (for example rushed reply 95%, AI draft 40%), and the new-listing check (4.5% → 2.1%). Token checks and the "no promises outside policy" check. The send gate (a Send button stays off if any check fails). |

## Assumptions (`config/params.json`)

| Value | Meaning |
|---|---|
| Dispute probabilities per product (cardigan 3.6% total, from source notes) | Chance an order becomes a dispute. Cardigan is an assumption; the other three products are **temporary** assumptions (`가정(임시)`, Q5). |
| Win probability without tracking (0.10 to 0.30 by cause) | Chance of winning if the seller fights. Only partly sourced; most values are **temporary** assumptions. |
| Win probability with tracking or carrier record (0.80, or 0.60 for customs delay) | Same, with delivery evidence. Assumption. |
| Fix effects (tracking ×0.25 on "not shipped", color note ×0.4, customs notice ×0.5) | How much each fix lowers a dispute type. Assumption. |
| Offer acceptance rate 0.72 | How often a buyer accepts a partial offer. Assumption. |
| Offer size 15% of the order | Our fixed policy value, not optimized. |
| Seller time per dispute $2 | Cost of the seller's time. Assumption. |
| Current habit: 50% full refund, 50% fight | Baseline behavior used for "as-is". Assumption. |

## Assumptions (`config/reply-model.json`, `config/listing-model.json`)

Both files are marked `source: "가정(기획 시안)"`: **assumption (design draft)**. The weights come from our design prototype, not from statistics. They drive the largest numbers on screen.

| File | What it drives |
|---|---|
| `config/reply-model.json` | The live reply forecast and risk %: the curve "80% → 40%", rushed reply "Chargeback 95%" and "Expected cost $85", AI draft "Chargeback 40%", the buyer-reaction bars and mood, the "+N pts" chips, and the Risk % of each "What happens next · Simulated" step. The engine calibrates it to the `params.json` values above (the AI draft costs about $37, the same as the Reply card). |
| `config/listing-model.json` | The new-listing check at `/demo/store/new-product`: base dispute rates by type, the peak-season multiplier, fix effects and win chances, run over 500 simulated sale periods with a fixed seed. It gives 4.5%, $770 ($472–$1,140) before fixes and 2.1%, $327 ($106–$576) after. The $15 fee, $2 time cost and refund share come from `params.json`. |

**Not an assumption:** the **$15 dispute fee** is PayPal's published US Standard Dispute Fee. We charge it only when the seller loses, which matches PayPal's published rule for the Standard fee. That Hannah is on the Standard fee is an assumption (see limit 2).

## Known limits

1. **Probabilities are assumptions, not statistics.** The app starts from knitwear-style averages and says so; it does not learn from real history yet. How much this matters, checked with the engine: with the carrier record, a reply beats a refund for Seo-yeon whenever the win chance is above about 17% (we assume 60%). Without it, the refund wins only narrowly — $74 versus $75.95 expected to fight at our assumed 15% (PayPal Standard $15 fee).
2. **We assume Hannah pays the Standard dispute fee ($15).** PayPal's published rules (fees page and User Agreement, updated Nov 4, 2026) waive the Standard fee when the seller wins, when the case is settled before it becomes a claim, and when an offer is accepted at that stage, so our formula matches them. Sellers with a claim rate of 1.5% or more and over 100 sales in the last three months pay the High Volume fee instead: $30, charged even on a win. The demo shop's history could put it in that tier; if so, replying still beats refunding in the Seo-yeon case, but with less margin (the win chance needed rises from about 17% to about 42%). Also not modeled: the fee on a refund made after a case becomes a claim, the waiver for unauthorized-payment cases, and the waiver for orders under $30.
3. **Chargebacks are priced like PayPal disputes.** The same loss formula is used for card-issuer chargebacks. Real chargebacks have different rules, fees, and win rates.
4. **The simulation range (P10 to P90) does not include uncertainty in the assumptions themselves.** It reflects random variation across 500 simulated futures with fixed inputs only. If the assumed rates are wrong, the whole range moves.
5. **No carrier integration.** Carrier events are demo data. PayPal's tracking API accepts only a SHIPPED status, so real delivery or customs events are not read.
6. **The public demo simulates writes.** In the public deployment, send, offer, and add-tracking calls make zero PayPal write requests and show "Simulated". Reads are real sandbox calls. AI answers are cached, with a rate limit for uncached ones. Real sends happen only in the recording setup. Public demo: https://disputeless.onrender.com
7. **Seo-yeon's dispute is a re-filed case.** The first dispute on an order with tracking moved to PayPal review within minutes, so we filed a new one on an order without tracking (the case where the seller forgot to register tracking).
8. **Reply dates mean "I will check and write back by then",** not a delivery estimate. The code blocks refund, reship, or discount promises that the seller's policy does not allow.
9. **The cause of the Seo-yeon case comes from demo carrier data.** Without it, PayPal data alone points to a full refund. That contrast is the point of the demo, and it depends on that data.
