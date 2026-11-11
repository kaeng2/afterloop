<!-- Devpost 소개글 초안 (영어). 근거: PRD v3, SPEC v2.10, DECISIONS. [확인 필요]는 제출 전 사람이 채운다. -->

# DisputeLess

**PayPal data alone says refund. One carrier event changes the answer.**

Seo-yeon, a buyer in Korea, writes in Korean that her sweater has not arrived and that she will go to her card company. The seller, Hannah, can't read the message. On PayPal data alone, the safe move is a full refund, about $74 counting her time. But a carrier record shows the parcel is not lost. It is held at Korean customs, waiting for one number from the buyer. With that, DisputeLess's code switches the recommendation from a refund to a reply, expected loss about $37. AI translates her message and drafts a reply in natural Korean. Hannah checks it and sends it through PayPal.

(Carrier feed is demo data; dispute reads, the message and the send are real PayPal sandbox calls.)

**How much does the answer depend on our assumptions?** With the carrier record, a reply beats a refund whenever the chance of winning the dispute is above about 17%. We assume 60%, so that recommendation holds even if our guess is far off. Without the carrier record the refund is a close call: $75.95 expected to fight versus $74 to refund at our assumed 15% win chance (PayPal's $15 Standard dispute fee, charged only when the seller loses). That contrast is the point: one carrier event moves the case from a coin flip to a clear answer. (Checked with the app's engine.)

**Try it:** https://disputeless.onrender.com — public demo mode: real sandbox reads, cached AI answers, and simulated sends (no PayPal writes from the public link).

## Inspiration

Small sellers who ship abroad often lose disputes they could have settled, because they can't read the buyer's language or know the customs rules. Many just refund. A dispute costs more than the order: Chargebacks911 estimates merchants lose on average more than four dollars for every dollar disputed ([Chargebacks911](https://chargebacks911.com/consumer-pricing/), merchant survey estimate). On PayPal, a US seller pays a $15 Standard Dispute Fee ([PayPal US merchant fees](https://www.paypal.com/us/business/paypal-business-fees)). And a parcel that never arrives costs the customer too: 57.4% of shoppers in Sendcloud's survey of eight European countries say they won't buy again from that retailer ([Sendcloud, 2025](https://www.sendcloud.com/how-delivery-frustrations-impact-repeat-purchases/)). We wanted a tool that works in the settlement window, before a dispute becomes a chargeback, and that tells the seller *why* it is happening. The buyer gains too: an answer in their own language and a real explanation.

## What it does

DisputeLess is a post-purchase copilot for small sellers on PayPal. The demo runs one morning for a fictional seller, Hannah Cole of Fernwood Knits.

- **Products.** For the 120 cardigans she has left, DisputeLess replays the next 120 sales 500 times. Selling as-is, the average dispute loss is about $216. With four fixes switched on, the same 500 futures cost about $44. The range and the assumptions are shown. The product table is built on AG Grid.
- **Today.** One list of what needs her. Two orders shipped without tracking in PayPal; one click adds tracking through PayPal's API.
- **Case detail (Seo-yeon).** A before/after comparison ("PayPal data only" vs "with carrier data"), the Korean original with an English translation, a reply for Hannah to review in English and Korean, checks on facts and promises, and a **Send in Korean** button. After sending, her risk score drops from 6 to 3.
- **PayPal activity drawer.** Every call DisputeLess makes for Hannah, with method, path, and response code.

**AI suggests, code decides.** AI translates, writes coaching and drafts, and judges tone. Code decides the cause, the expected loss and suggested amount, the follow-up date, and whether a message may be sent. Dates, amounts and names reach the AI only as tokens and are filled in by code.

## How we built it

**PayPal sandbox APIs we actually called** (each succeeded in the sandbox):
- OAuth token and Orders API (create and capture) for 13 sandbox orders
- Disputes: list and detail (`GET /v1/customer/disputes`)
- Disputes: `send-message`, tested in Korean and English on a practice dispute (200); the Seo-yeon send is made on camera. [확인 필요: 녹화 후 실제 전송 결과(200)와 분쟁 번호]
- Disputes: `make-offer`, a partial-refund offer on a practice dispute (200, $10.80)
- Orders tracking: `POST /v2/checkout/orders/{id}/track` (201 on a test order). [확인 필요: 녹화에서 O05·O07 등록 201]
- Transaction Search: `GET /v1/reporting/transactions` for sales by product, cached for 15 minutes

**AI.** `claude-opus-5-5`, called only from the server. It translates, drafts and back-translates replies, writes short coaching chips, judges angry tone, classifies cases that no rule covers, and writes color-note wording. Output is validated against schemas and treated as untrusted.

**Code.** The seeded simulation is deterministic: the same input always gives the same result, and "as-is" and "with fixes" use the same random numbers, so the difference comes from the fixes, not luck.

**Stack.** Next.js 15, React, TypeScript, zod, AG Grid Community for the product table, deployed on Render (https://disputeless.onrender.com).

**What is real and what is not.** Sandbox orders, disputes (including the Korean complaint text), reads, sends and tracking are real PayPal sandbox. Carrier events, earlier inquiries and closed-dispute history are demo data. Rates and win probabilities are our assumptions. The full table is in the README (https://github.com/kaeng2/afterloop#readme).

## Challenges we ran into

- **Bulk tracking was blocked.** PayPal's `trackers-batch` returned 403 in our app, so we register tracking order by order with `/v2/checkout/orders/{id}/track`.
- **Tracked orders skipped our demo.** A "not received" dispute on an order with tracking moved to PayPal review within minutes, where messages and offers are not available. We re-filed Seo-yeon's dispute on an order without tracking, and the app never registers tracking on an order that already has a dispute.
- **Message first, offer closed.** Once a seller sends a message, PayPal closes the make-offer link until the buyer replies. For cases where an offer is the best move, DisputeLess sends the offer first and puts the explanation in its note.
- **AI changed what a date meant.** In one run the follow-up date was "delivery by this day", in another "reship if it doesn't arrive". We now tell the model what the date means (the day the seller checks and writes back), let code compute it, and block promises of refunds, reshipping or discounts outside the seller's policy. Code checks every draft.
- **Honest numbers.** Probabilities and win rates are assumptions. We label them, show a range, and say where the data is demo data.

## Accomplishments that we're proud of

- A case where the answer changes with one piece of data, shown with real PayPal dispute data and a real send.
- A clear line between what AI writes and what code decides, enforced by checks, not by trust.
- Every PayPal call listed in a drawer, so the real parts can be seen.

## What's next for DisputeLess

- A recurrence report: group closed disputes by cause, product and country, and feed them into next month's check.
- Carrier comparison and real carrier integration.
- A policy settings screen for what replies may promise.
- Calibrating rates from the seller's own dispute history through Transaction Search and the Disputes API.
