# Testing DisputeLess

Live demo: https://disputeless.onrender.com (public mode — real PayPal sandbox reads, cached AI, simulated sends; nothing is written to PayPal).

No login is needed. Open the [seller dashboard](https://disputeless.onrender.com/demo/seller-dashboard) and follow three steps. The first load can take a few seconds while the free server wakes up.

1. **Reply to Seo-yeon.** On [`/demo/seller-dashboard`](https://disputeless.onrender.com/demo/seller-dashboard) (marked "Demo mock — not a real PayPal page"), click **Handle all 3 with DisputeLess**. On the desk, turn on **✦ AI Respond now**. Click **Try a rushed reply** and wait until the typing stops (95%). Click **Use AI draft** and wait about 16 seconds until the typing stops (40%); before that, the forecast shows in-between numbers. Open **Details**, and click **Send**. Watch "What happens next · Simulated" and click **Forward to carrier**.
2. **See the other cases.** Click the **Knit Cardigan** product chip (opening an item selects its product chip) to open Ji-ho's card: new quality case #1038 (`PP-R-ZOK-10200237`, under PayPal review), "Keeps ≈$34", "How AI handled this". Click **All products** for the overview with two AG Grid tables, then **PayPal activity** (top right) for the call log.
3. **Check a new listing.** Type [`/demo/store/new-product`](https://disputeless.onrender.com/demo/store/new-product) in the address bar. Click **Publish product** (4.5%), then **See details and fix**. Click all six **Insert** buttons, then **Recalculate** (2.1%). This is a standalone screen.

Public mode makes real sandbox reads. Send, Send offer, Add all, Refund, Looks good and Forward are **Simulated** (zero PayPal writes).

Notes
- The first request after the server wakes up can take a few seconds (Render free tier + PayPal sandbox reads). After that, clicks are fast.
- Numbers marked **Assumption** come from stated assumptions; items marked **Demo data** come from seed data. See the [honesty table](honesty-table.md).
- Language: **EN | 한국어** at the top right of the seller dashboard and the desk switches screen text only (numbers, buyer messages and AI text stay the same). `/demo/store/new-product` has no switch: it uses the language remembered from the other screens (cookie), or add `?lang=ko` (or `?lang=en`) to its address.
- AI: answers for the demo cases are cached. Uncached AI calls on the public link have an hourly cap; when it is reached, the screen says so instead of calling the model.

## Test credentials

- **No login is needed.** The public link opens directly; there is no account to sign in to.
- We do not share the PayPal sandbox login, because a shared login could change the demo dispute cases (replies, offers, refunds) for every other tester.
- To run DisputeLess against your own sandbox: create a free app at [developer.paypal.com](https://developer.paypal.com) (Sandbox → Apps & Credentials), then put its credentials in a local `.env` file as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, copy `.env.example` to `.env` for the other names, and run `npm install && npm run build && npm start`. Your own sandbox disputes will appear instead of ours.
