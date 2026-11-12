# Testing DisputeLess

Live demo: https://disputeless.onrender.com (public mode — real PayPal sandbox reads, cached AI, simulated sends; nothing is written to PayPal).

Open these three addresses. They are separate screens; none links to the others except where noted.

| Order | Address | What you see |
|---|---|---|
| 1 | [`/intro`](https://disputeless.onrender.com/intro) | First scene: a demo seller dashboard (marked "Demo mock — not a real PayPal page"). Click **Handle all with DisputeLess** or **Respond →** to go to the desk. |
| 2 | [`/`](https://disputeless.onrender.com/) | The DisputeLess desk: three real PayPal sandbox disputes. Pick Seo-yeon's case (Wool Sweater) to see the risk curve, the options the engine compared, and the reply editor with a live forecast. **Send** is simulated in public mode. |
| 3 | [`/listing`](https://disputeless.onrender.com/listing) | New-listing check: a demo store admin "Add a product" form. **Publish product** runs the pre-publish check (500 simulated sale periods, assumed rates); **See details and fix** shows what to add. Standalone screen. |
| — | [`/products`](https://disputeless.onrender.com/products) | Product table (AG Grid) with the Black Friday rehearsal per product. Reachable by address only. |

Notes
- The first request after the server wakes up can take a few seconds (Render free tier + PayPal sandbox reads). After that, clicks are fast.
- Numbers marked **Assumption** come from stated assumptions; items marked **Demo data** come from seed data. See the [honesty table](honesty-table.md).
- Language: **EN | 한국어** at the top right switches screen text only (numbers, buyer messages and AI text stay the same).
- AI: answers for the demo cases are cached. Uncached AI calls on the public link have an hourly cap; when it is reached, the screen says so instead of calling the model.

## Test credentials

- **No login is needed.** The public link opens directly; there is no account to sign in to.
- We do not share the PayPal sandbox login, because a shared login could change the demo dispute cases (replies, offers, refunds) for every other tester.
- To run DisputeLess against your own sandbox: create a free app at [developer.paypal.com](https://developer.paypal.com) (Sandbox → Apps & Credentials), then put its credentials in a local `.env` file as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, copy `.env.example` to `.env` for the other names, and run `npm install && npm run build && npm start`. Your own sandbox disputes will appear instead of ours.
