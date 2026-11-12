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

- **Seller dashboard (demo mock).** `/demo/seller-dashboard` is a mock seller dashboard, marked "Demo mock — not a real PayPal page", with three open cases. **Handle all 3 with DisputeLess** opens the DisputeLess desk.
- **Seo-yeon's case on the desk.** A risk curve shows the dispute risk falling from 80% to 40% with the AI draft. The Korean original sits next to an English translation, with an AI summary of the case history. The chargeback risk updates as Hannah edits: **Try a rushed reply** shows the live forecast at 95% (expected cost $85); **Use AI draft** brings it back to 40% (about $37). **Details** shows what PayPal data alone would suggest ("PayPal data only: Full refund $74"), the checks (facts match, no new promises, follow-up date) and the Korean text Seo-yeon will see. Then **Send in Korean**.
- **What happens next · Simulated.** After sending, the desk shows the expected steps, labeled as simulated, not real events. The path branches on the sent reply's forecast. For the AI draft: Seo-yeon replies with her customs ID, Hannah approves forwarding it to the carrier, and customs releases the parcel.
- **The other cards.** Ji-ho's case offers "Offer 15% back ($7.20), the buyer keeps it" with one **Send offer** button. A Missing tracking card finds two orders shipped without tracking in PayPal; **Add all 2** adds tracking through PayPal's Orders tracking API (simulated on the public link, like every send). Finished items collect under **Done today**.
- **New-listing check.** `/demo/store/new-product` is a demo store's "Add a product" form. **Publish product** first runs our check (`POST /api/listing-check`, no PayPal call): 500 simulated sale periods under assumed rates give a dispute chance of 4.5% per order and an expected loss of $770. AI suggests listing text for six gaps (measurements, delivery time and tracking, customs ID, peak season, returns, color); after Hannah fills in her real details, the same check shows 2.1% and $327. Nothing is published to a real shop.
- **PayPal activity drawer.** Every PayPal call DisputeLess makes for Hannah, with method, path, and response code. On the public link, sends are listed as "Simulated · not sent".

**AI suggests, code decides.** AI translates, writes coaching and drafts, and judges tone. Code decides the cause, the expected loss and suggested amount, the risk % and reply forecast, the follow-up date, and whether a message may be sent. Dates, amounts and names reach the AI only as tokens and are filled in by code.

## How we built it

**PayPal sandbox APIs we actually called** (each succeeded in the sandbox):
- OAuth token and Orders API (create and capture) for 13 sandbox orders
- Disputes: list and detail (`GET /v1/customer/disputes`)
- Disputes: `send-message`, tested in Korean and English on a practice dispute (200); the Seo-yeon send is made on camera. [확인 필요: 녹화 후 실제 전송 결과(200)와 분쟁 번호]
- Disputes: `make-offer`, a partial-refund offer on a practice dispute (200, $10.80)
- Orders tracking: `POST /v2/checkout/orders/{id}/track` (201 on a test order). [확인 필요: 녹화에서 O05·O07 등록 201]
- Transaction Search: `GET /v1/reporting/transactions` returned 200 in our sandbox setup check and is implemented in code (`src/paypal/transactions.ts`), but no screen in the current app calls it

**AI.** `claude-opus-5-5`, called only from the server. It translates, drafts and back-translates replies, writes short coaching chips, judges angry tone, classifies cases that no rule covers, summarizes a case's history, and writes the suggested listing text in the new-listing check (with `[__]` blanks the seller fills in; the AI writes no numbers). Output is validated against schemas and treated as untrusted.

**Code.** The seeded simulation is deterministic: the same input always gives the same result, and "as-is" and "with fixes" use the same random numbers, so the difference comes from the fixes, not luck.

**Stack.** Next.js 15, React, TypeScript, zod, AG Grid Community for the All products overview tables (Products and Cases by risk), deployed on Render (https://disputeless.onrender.com).

**What is real and what is not.** Sandbox orders, disputes (including the Korean complaint text), reads, sends and tracking are real PayPal sandbox. Carrier events, earlier inquiries and closed-dispute history are demo data. Rates, win probabilities, the reply forecast and the new-listing check weights are our assumptions. The full table is in `docs/submission/honesty-table.md` (https://github.com/kaeng2/afterloop/blob/main/docs/submission/honesty-table.md).

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

## Testing instructions

- **Live demo, no login needed:** https://disputeless.onrender.com — open `/demo/seller-dashboard` → click **Handle all 3 with DisputeLess** (or **Respond** on Seo-yeon's row) to reach the desk `/`, then type `/demo/store/new-product` in the address bar. Full steps: `docs/submission/testing.md` in the repo. [확인 필요: 저장소 공개 뒤 GitHub 링크로]
- Public mode: reads are real PayPal sandbox calls; send, offer and add-tracking are **Simulated** (zero PayPal writes). AI answers for the demo cases are cached; uncached AI calls have an hourly cap.
- We don't share the sandbox login (a shared login could change the demo disputes). To use your own sandbox, create a free app at developer.paypal.com and set `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` in `.env`.

## What's next for DisputeLess

- A recurrence report: group closed disputes by cause, product and country, and feed them into next month's check.
- Carrier comparison and real carrier integration.
- A policy settings screen for what replies may promise.
- Calibrating rates from the seller's own dispute history through Transaction Search and the Disputes API.
