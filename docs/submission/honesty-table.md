<!-- 메모(한국어): README에 넣을 정직성 표 초안. 근거는 PRD v3 16장, SPEC v2.10, DECISIONS, config/params.json. 심사위원이 30초에 읽도록 짧게 줄임. 가정값 목록은 params.json의 source 기준. -->

# What is real, what is assumed

DisputeLess is a hackathon prototype on the **PayPal sandbox** with a **fictional seller** (Hannah Cole, Fernwood Knits). Every number on screen is an example, not a forecast.

| Column | What it covers |
|---|---|
| **Real (PayPal sandbox)** | 13 sandbox orders (Orders API, captured). 3 live demo disputes, including the buyer-filed Korean complaint text. Dispute list and detail reads. Messages sent in Korean and English (HTTP 200, tested on a practice dispute). A partial-refund offer via make-offer (HTTP 200, practice dispute). Per-order tracking via `POST /v2/checkout/orders/{id}/track` (201). Sales read via Transaction Search `GET /v1/reporting/transactions` (cached 15 min). |
| **Assumptions** | See the list below. Rates, win probabilities, and policy choices that we set ourselves. Marked with an Assumption badge in the app. |
| **Demo data** | Carrier tracking and customs events (for example "Oct 30 · Customs hold" on Seo-yeon's order). Pre-dispute inquiries (Seo-yeon's Nov 2 message, which drives the "no reply yet" signal). Mike's two earlier claims. 6 closed disputes and the order history behind the $413 loss total. Order dates on screen. Buyers outside the sandbox. Marked with a Demo data badge. |
| **What AI does** | Translates the buyer's Korean message. Writes reply coaching, the short "reply covers" chips, and the English draft with a natural Korean version, then back-translates it. Judges an angry tone. Classifies cases that no rule covers. Writes the color-note wording. Facts (dates, amounts, names) reach the AI only as tokens such as `⟦DATE_1⟧` and are filled in by code. |
| **What code decides** | The cause of a case (rule: a customs hold in the carrier record means "held at customs", with zero AI calls). Expected loss and the suggested move and amount. The follow-up date (send date + 7 days, pulled earlier if the PayPal response deadline comes sooner). The risk score. Token checks and the "no promises outside policy" check. The send gate (a Send button stays off if any check fails). |

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

**Not an assumption:** the **$15 dispute fee** is PayPal's published US Standard Dispute Fee. We charge it only when the seller loses (see limit 2).

## Known limits

1. **Probabilities are assumptions, not statistics.** The app starts from knitwear-style averages and says so; it does not learn from real history yet.
2. **Fee rules are not confirmed (open question Q7).** We assume the $15 fee applies only when the seller loses, and that settling or an accepted offer is free. Whether a win also incurs the fee, and whether a refund after the claim stage carries a fee, is unconfirmed. [확인 필요: Q7 답 도착 여부]
3. **Chargebacks are priced like PayPal disputes.** The same loss formula is used for card-issuer chargebacks. Real chargebacks have different rules, fees, and win rates.
4. **The simulation range (P10 to P90) does not include uncertainty in the assumptions themselves.** It reflects random variation across 500 simulated futures with fixed inputs only. If the assumed rates are wrong, the whole range moves.
5. **No carrier integration.** Carrier events are demo data. PayPal's tracking API accepts only a SHIPPED status, so real delivery or customs events are not read.
6. **The public demo simulates writes.** In the public deployment, send, offer, and add-tracking calls make zero PayPal write requests and show "Simulated". Reads are real sandbox calls. AI answers are cached, with a rate limit for uncached ones. Real sends happen only in the recording setup. [확인 필요: 공개 Render 배포 여부와 링크]
7. **Seo-yeon's dispute is a re-filed case.** The first dispute on an order with tracking moved to PayPal review within minutes, so we filed a new one on an order without tracking (the case where the seller forgot to register tracking).
8. **Reply dates mean "I will check and write back by then",** not a delivery estimate. The code blocks refund, reship, or discount promises that the seller's policy does not allow.
9. **The cause of the Seo-yeon case comes from demo carrier data.** Without it, PayPal data alone points to a full refund. That contrast is the point of the demo, and it depends on that data.
