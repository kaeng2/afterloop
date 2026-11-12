# DisputeLess ㅣ fewer disputes for PayPal sellers.

**Stop disputes before they start.**

> **Predict risk. Resolve with confidence. Prevent the next dispute.**  
> DisputeLess brings AI-powered buyer communication and explainable risk modeling into the PayPal merchant workflow—helping sellers understand what went wrong, choose a financially sensible response, and improve their next sale before it goes live.

>
[🚀 Live Demo](https://disputeless.onrender.com/demo/seller-dashboard) ·
[🎬 Demo Video](https://youtu.be/cGdfF0rBP98?si=MAMs87csK5_Xo9w2) 

<img width="931" height="563" alt="스크린샷 2026-11-13 오전 12 37 39" src="https://github.com/user-attachments/assets/5bfbec7d-07df-4f57-bffb-d54522771254" />

---

## 1. Why we built it

Selling globally has become easier. Resolving a cross-border payment dispute has not. Mastercard forecasts a **24% increase** in worldwide chargebacks, reaching **324 million a year by 2028**. This is an industry-wide chargeback forecast, not a PayPal-specific statistic. ([Source: Mastercard](https://www.mastercard.com/au/en/news-and-trends/Insights/2025/what-s-the-true-cost-of-a-chargeback-in-2025.html))

For independent merchants and small businesses, a single *Item Not Received* complaint can mean a package was never shipped, is stuck in customs, was lost in transit, or was marked delivered without reaching the buyer. Each calls for a different response. Yet merchants often have to decide quickly, across languages, without a dedicated support team—or a clear view of the financial consequences.

**The question we set out to answer: How can sellers reduce disputes proactively, while making the risk and cost of each decision measurable?**

---

## 2. The product and who it's for

**DisputeLess** is an AI-powered dispute prevention and decision platform for **independent sellers, first-time merchants, small businesses, and growing online merchants** using PayPal. It is designed for sellers across product categories, particularly those handling international orders without specialist dispute operations.

Unlike a dispute dashboard that stops at tracking cases, DisputeLess connects **diagnosis → resolution → learning → prevention**. It gives merchants actionable numbers—not just another alert—and keeps sellers in control of consequential actions.

<img width="1536" height="867" alt="스크린샷 2026-11-13 오전 1 24 29" src="https://github.com/user-attachments/assets/74d3b1f8-7652-4cd7-a693-769f3bff18a7" />


---

## 3. Our solution

### ✅ Solution 1 — Make disputes measurable

**From broad dispute codes to clear operational causes and quantified choices.**

### 💡 1.1 Go beyond reason codes: 16 operational causes

A PayPal dispute reason describes **what the buyer is claiming**. That alone does not establish **why the problem happened**. DisputeLess uses the reason, buyer messages, order history, and shipping signals to classify a case into **6 groups and 16 more specific causes**:

| Group | Operational causes | Related PayPal dispute reason |
| --- | --- | --- |
| **A · Fulfillment (4)** | A1 Not shipped / late dispatch; A2 Carrier or customs delay; A3 Lost in transit; A4 Delivered-status mismatch | Item Not Received (INR) |
| **B · Product mismatch (5)** | B1 Color; B2 Size/fit; B3 Material/quality; B4 Damage/stains; B5 Wrong item | Significantly Not as Described (SNAD) |
| **C · Billing/refund (3)** | C1 Promised refund not processed; C2 Duplicate charge; C3 Incorrect amount | Corresponding billing/refund reasons |
| **D · Subscription (1)** | D1 Charged after cancellation | Canceled recurring payment |
| **E · Authorization (1)** | E1 Unauthorized-payment claim | Unauthorized transaction |
| **F · Repeated claims (2)** | F1 Repeated non-receipt claims; F2 Repeated partial-refund requests | INR / SNAD patterns |

AI proposes a subtype **with supporting evidence and a confidence level**. Low-confidence or sensitive cases go to seller review. Patterns of repeated claims are not treated as proof of wrongdoing.

**Why this matters:** A customs hold calls for a customs-information request, not the same reply as a lost parcel. More precise causes lead to better choices today—and better preventive changes tomorrow.

### 💡 1.2 For an open dispute, how do we separate high-risk cases from low-risk ones?

**Merchant question:** *Which cases need attention first—and what could each response cost?*

Once a dispute or buyer complaint arrives, DisputeLess groups it by operational cause and surfaces a **high-, medium-, or low-risk priority**. The priority is backed by a numerical escalation estimate, so a seller can see not only *which case is urgent* but *why*. The experience also provides a timeline of past exchanges rather than treating the latest buyer message as an isolated event.

DisputeLess uses an **interpretable logistic risk model** to convert case and reply features—such as delivery delays, whether the seller explains the cause, offers a concrete next step, or commits to a date—into a **0–100% modeled escalation score**.

```text
P(escalation) = 1 / (1 + exp(-z))
z = baseline + Σ(case signal × weight) + Σ(response feature × weight)
```

The risk estimate takes the case context and response features into account. For example, a delayed shipment becomes more sensitive when the seller has already missed a promised delivery date, responded late, or failed to provide usable tracking information. This is where DisputeLess goes beyond an inbox triage tool: **AI reviews the accumulated buyer–seller interaction history and available dispute signals, then proposes steps intended to de-escalate the specific relationship**—such as replying in the buyer’s language, using a carrier-verified date instead of making a new unsupported promise, and offering a clear fallback. Historical patterns inform the advice; they are not treated as proof of buyer misconduct.

A separate **expected-cost calculation** combines the modeled likelihood of different outcomes with their financial consequences:

```text
Expected cost = Σ[P(outcome) × cost(outcome)]
```

**Why this approach?** Prioritizing cases by an explainable score helps time-constrained sellers focus first on likely escalation, while retaining enough context to choose a proportionate response. Logistic modeling makes the influence of each response feature inspectable and allows immediate before/after comparisons. Expected cost adds the economic dimension: **the response with the lowest escalation score is not necessarily the least expensive**. The interface therefore places **risk (%) and estimated cost ($)** side by side, giving sellers a basis for a defensible decision rather than a black-box AI verdict.

*Demo reference:* In the customs-delay case (**order #1042, $72, subtype A2**), the illustrative model scores no response at **91%**, a rushed reply at **95%**, the targeted customs-information reply drafted by AI at **40%** with approximately **$37** in expected cost, and a full refund at approximately **$74** in cost. These are demo-model outputs, not measured real-world success rates.


### ✅  Solution 2 — Turn insights into a better resolution

**Use the entire case history—not just the last message—to choose a credible next step.**

### 💡 2.1 Negotiate in the buyer's language, with full transaction context

PayPal connects buyers and sellers across countries, languages, shipping networks, and customs requirements. Simply translating a sentence is not enough when the solution depends on the buyer's location, the parcel's status, or missing import information.

DisputeLess uses AI to **interpret the buyer's concern, match it to transaction and shipping evidence, and propose a practical response in the buyer's language**. Sellers can review alternative actions alongside their estimated risk and cost. This shortens the path from *“What does the buyer mean?”* to *“What can we do about it?”*

<img width="589" height="576" alt="스크린샷 2026-11-13 오전 1 40 31" src="https://github.com/user-attachments/assets/67c4d93d-1cf7-47a6-81e2-e30db1082dfa" />

> Repeated buyer–seller exchanges have created frustration on both sides, with a **91% dispute risk**. DisputeLess provides an at-a-glance view of the case history, status, and risk level.

<img width="589" height="500" alt="스크린샷 2026-11-13 오전 1 34 07" src="https://github.com/user-attachments/assets/53fa5e96-3e1c-4c41-b191-9f50af753639" />

> AI Respond now: the reply is drafted in the buyer’s language and checked line by line. Dispute risk drops from 91% to 40%



### 💡 2.2 Keep the merchant in control

Before a response or eligible PayPal action is submitted, guardrails check dates, amounts, and promises against available case evidence. **Money-moving actions require explicit seller approval**. The AI helps the merchant decide; it does not make unapproved financial commitments.

### ✅ Solution 3 — Prevent the next dispute before publishing

**Test the financial exposure of planned sales before committing to a listing.**

### 💡 3.1 Before listing: how can a seller know what future disputes might cost?

New sellers and small businesses want to give shoppers the clearest, most accurate product information they can: sizing, materials, delivery windows, customs requirements, and return terms. But they rarely know **which missing detail is most likely to trigger a complaint—or how much that omission could cost across an entire batch of orders**.

A listing that looks good for one buyer can create repeated issues when **200 units** are sold. Before publishing, the seller needs a way to convert gaps in size guidance, product photos, shipping estimates, and customs instructions into **a forward-looking estimate of dispute exposure**. By entering a **planned sales quantity**, the merchant can see how seemingly minor gaps scale into potential dispute counts and financial exposure. That makes prevention tangible **before inventory, marketing spend, and customer expectations are committed**.

####💡 3.2 Make risk visible: frequency × severity, 500 simulations, and one dot per sale

DisputeLess separates **how often** a dispute cause may occur from **how much** a resulting case may cost:

```text
Expected loss by cause ≈ planned units × incident probability × average loss per incident
```

<img width="765" height="678" alt="스크린샷 2026-11-13 오전 1 44 16" src="https://github.com/user-attachments/assets/24e2b46c-83af-403a-ac18-e0febf93697a" />


> Visualization. A risk curve across the case history shows how trust broke down. In the rehearsal, one dot = one planned sale, with disputes colored in, so a first-time seller sees the scale at a glance. Risk (%) and cost ($) always appear together, and red is used only for high risk.

The listing rehearsal runs a **500-iteration seeded Monte Carlo simulation**, estimating dispute counts and loss distributions for a planned sales volume. It then reruns the scenario with proposed listing improvements under comparable random conditions.

<img width="1474" height="528" alt="스크린샷 2026-11-13 오전 1 49 46" src="https://github.com/user-attachments/assets/1deeb176-95fc-42b7-96ff-fdbe1be08704" />

**A visual explanation, not just a number:** The demo presents planned sales as a **dot matrix—one dot for one sale**. Dots representing modeled dispute counts are colored by cause, making the scale and mix of potential complaints immediately understandable. Applying suggested listing fixes updates the dot pattern and expected-loss figure side by side. The **500 simulation runs are the calculation engine**; the **dots visualize the planned units and modeled results**, not 500 individual simulation runs.

** 🔎 Why this approach?** A single “high/medium/low” label cannot distinguish common, low-cost issues from rare, expensive ones. **Frequency × severity** prioritizes improvements by economic exposure; simulation shows the range of possible outcomes rather than suggesting there is one certain future. A fixed seed makes before/after comparisons reproducible.

The classification framework covers **16 causes**, while the supplied listing rehearsal models **five** of them quantitatively: **A1, A2, B1, B2, and E1**. The demo uses `mulberry32`, seeded with `4242 + planned units`.

*Demo reference:* A **$89 product with a planned sale of 200 units** moves from a **4.5% to a 2.1% chance of a dispute per order** (about **9.0 to 4.1 modeled disputes**) and **$770 to $327 in modeled expected loss** after six listing improvements—approximately **58% lower expected loss** under the demo assumptions. These are simulated results, not observed merchant savings.

---

## 4. End-to-end product flow

<img width="1606" height="262" alt="스크린샷 2026-11-13 오전 1 50 38" src="https://github.com/user-attachments/assets/bb97dd78-caf2-4f77-a44d-6176563fa96a" />


**AI understands the context and helps communicate. Transparent calculation engines provide the risk and cost estimates. Merchant approval governs financial execution.**

---

## 5. Demo: three connected scenes

| Scene | What judges see | What it demonstrates |
| --- | --- | --- |
| **1 · One-click access** | Launch **DisputeLess from the top of a PayPal-style seller dashboard** and enter the dispute workspace | Fits naturally into the merchant's existing workflow; the dashboard shown is a **demo mockup** |
| **2 · Negotiate & resolve** | Open **#1042 / $72**, review the Korean customs-delay evidence (**A2**), inspect the nine-event buyer–seller history and risk trajectory, compare no response vs. a targeted request vs. refund, edit the AI-supported reply, approve an action, and inspect the result | A concrete link between root cause, **escalation risk (%)**, **expected cost ($)**, multilingual communication, and safe execution |
| **3 · Prevent & rehearse** | Prepare a new **$89 listing / 200 units**, review the **one-dot-per-sale** dispute map and cause-level exposure, apply **six improvements**, rerun the 500-iteration model, and publish | Potential disputes become intuitive on a **200-dot sales map**, and prevention is financially visible **before selling**: **4.5% → 2.1%** dispute chance and **$770 → $327** expected loss in the demo |

**Core test scenarios:** a shipment delayed by missing Korean customs information; product-description mismatches involving color and size; and avoidable confusion around delivery timing, customs guidance, and returns. The product-listing scene represents an **external online-store admin experience using DisputeLess**, not a native PayPal product-listing screen.

---

## 6. The feedback loop: a smarter next sale

**DisputeLess turns each resolved case into a chance to prevent the next one.**

1. **Learn from the dispute:** Connect the buyer’s complaint with the operational cause, conversation timeline, available shipment evidence, and past patterns.
2. **Make a measurable decision:** Flag urgent cases and compare response options by modeled escalation risk and financial exposure.
3. **Resolve across borders:** Give the seller a context-aware reply in the buyer’s language and route consequential actions through explicit approval.
4. **Improve before the next sale:** Translate recurring causes into clearer product and delivery information; simulate the planned volume, compare the before/after dot maps, and publish with a more informed view of exposure.

The result is a **continuous improvement loop**, not another dashboard: **every response informs a better listing, and every better listing has the potential to reduce future disputes**. For small merchants, that means making proactive quality improvements tangible in both **expected case counts and dollars at risk**—before the next batch of orders goes live.

---

## 7. Technical architecture

```text
PayPal-style entry point       DisputeLess dispute desk      Store listing rehearsal
              \                      |                       /
                    Application backend / evidence layer
                      /             |              \
             PayPal REST APIs    AI services    Quantitative engines
              transactions      case summary   logistic response model
              disputes          cause labels   expected-cost comparison
              tracking          translation    500-run Monte Carlo
              approved actions  reply drafting
                      \             |              /
                     Validation, seller approval & activity log
                                     |
                          Root-cause prevention loop
```

**Separation of responsibilities:** PayPal is the source of payment/dispute/shipping context and approved eligible actions; the AI layer interprets unstructured buyer communication; the deterministic layer calculates risk and modeled loss. This prevents a language model from fabricating percentages or silently moving money.

---

## 👩🏻‍💻 8. PayPal integration and sponsor technology

## 8.1 PayPal Developer Platform — where the APIs fit

| PayPal integration | API route / capability | Purpose in DisputeLess |
| --- | --- | --- |
| **OAuth 2.0** | `POST /v1/oauth2/token` | Server-side access token; credentials never reach the browser |
| **Orders v2** | `POST /v2/checkout/orders`; `POST /v2/checkout/orders/{id}/capture`; `GET /v2/checkout/orders/{id}` | Create and capture the sandbox demo orders; read order details |
| **Disputes API** | `GET /v1/customer/disputes`; `GET /v1/customer/disputes/{id}` | Load case state, reason codes and buyer messages as the starting point for diagnosis |
| **Dispute message** | `POST /v1/customer/disputes/{id}/send-message` | Send the seller-approved reply |
| **Dispute offer** | `POST /v1/customer/disputes/{id}/make-offer` | Send a seller-approved partial-refund offer |
| **Order tracking** | `POST /v2/checkout/orders/{id}/track` | Add tracking to an order after seller approval |
| **Transaction Search API** | `GET /v1/reporting/transactions` | Implemented, not used on screen |

**Integration approach:** server-side OAuth 2.0 credentials, PayPal Sandbox orders and dispute scenarios for testing, and an activity log of every call. On the public link, writes (send-message, make-offer, tracking) are Simulated; the app never executes a refund.

### 8.2 AI and other sponsor tools

- **AI model/API:** Claude (`claude-opus-5-5`). Classifies buyer messages into operational causes with confidence and evidence; summarizes the case; prepares contextual multilingual replies; and suggests clearer product-listing language. Numeric risk and cost calculations remain outside the LLM.
- **Additional sponsor tools:** **AG Grid** — the two tables on the All products screen. **Render** — hosts the live demo.
- **Safety:** Explicit merchant approval for monetary actions; validation of promises, dates and amounts; server-side secret handling.

---

## ⭐ 9. What makes DisputeLess different

### Context-aware cross-border resolution

The value is not translation alone: DisputeLess considers the buyer’s language, the transaction, prior replies and missed commitments, and the available dispute history to recommend a response that addresses **why trust broke down**—rather than sending a generic translated template.

### Decision-ready risk visualization

High/medium/low case priorities, explainable risk percentages, estimated resolution costs, and **one-dot-per-sale simulations** turn uncertainty into something sellers can grasp at a glance, review, and challenge—not an opaque AI recommendation.

### Prevention before the next sale

DisputeLess doesn't end when the case is closed. It translates what the merchant learned into better listing information **before the next batch of orders**, helping small businesses sell with greater predictability and confidence.

---

## 10. Quick start for judges

Live demo: https://disputeless.onrender.com/demo/seller-dashboard (public mode — real PayPal sandbox reads, cached AI, simulated sends; nothing is written to PayPal).

**No login is needed.** Open the [seller dashboard](https://disputeless.onrender.com/demo/seller-dashboard) and follow three steps. The first load can take a few seconds while the free server wakes up.

1. **Reply to Seo-yeon.** On [`/demo/seller-dashboard`](https://disputeless.onrender.com/demo/seller-dashboard) (marked "Demo mock — not a real PayPal page"), click **Handle all 3 with DisputeLess**. On the desk, turn on **✦ AI Respond now**. Click **Try a rushed reply** and wait until the typing stops (95%). Click **Use AI draft** and wait about 16 seconds until the typing stops (40%); before that, the forecast shows in-between numbers. Open **Details**, and click **Send**. Watch "What happens next · Simulated" and click **Forward to carrier**.
2. **See the other cases.** Click the **Knit Cardigan** product chip (opening an item selects its product chip) to open Ji-ho's card: new quality case #1038 (`PP-R-ZOK-10200237`, under PayPal review), "Keeps ≈$34", "How AI handled this". Click **All products** for the overview with two AG Grid tables, then **PayPal activity** (top right) for the call log.
3. **Check a new listing.** Type [`/demo/store/new-product`](https://disputeless.onrender.com/demo/store/new-product) in the address bar. Click **Publish product** (4.5%), then **See details and fix**. Click all six **Insert** buttons, then **Recalculate** (2.1%). This is a standalone screen.

Public mode makes real sandbox reads. Send, Send offer, Add all, Refund, Looks good and Forward are **Simulated** (zero PayPal writes).

- Numbers marked **Assumption** come from stated assumptions; items marked **Demo data** come from seed data. See the [honesty table](docs/honesty-table.md).
- Language: **EN | 한국어** at the top right of the seller dashboard and the desk switches screen text only (numbers, buyer messages and AI text stay the same). `/demo/store/new-product` uses the language remembered from the other screens, or add `?lang=ko` (or `?lang=en`) to its address.
- AI answers for the demo cases are cached. Uncached AI calls on the public link have an hourly cap; when it is reached, the screen says so instead of calling the model.
- We do not share the PayPal sandbox login, because a shared login could change the demo dispute cases for every other tester. To run DisputeLess against your own sandbox: create a free app at [developer.paypal.com](https://developer.paypal.com) (Sandbox → Apps & Credentials), put its credentials in a local `.env` file as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, copy `.env.example` to `.env` for the other names, and run `npm install && npm run build && npm start`.

> **Data integrity note:** All percentages, case costs, and projected reductions above are outputs of assumed demo models, not measured results.

## Repository map

| Path | What it holds |
| --- | --- |
| `src/engine/` | Deterministic risk, expected-cost and listing-simulation engines (all numbers come from here) |
| `src/ai/` | Claude prompts and validation for classification, replies and listing fixes |
| `src/paypal/`, `src/exec/` | PayPal sandbox client (OAuth, Orders, Disputes, tracking) and the approval-gated executor |
| `src/app/` | Next.js app: seller dashboard demo, DisputeLess desk, new-listing check |
| `config/` | Assumed rates, policy rules, screen text (EN/KO), motion timings |
| `seed/`, `data/` | Demo seed data and the cached AI answers used on the public link |
| `scripts/` | Sandbox setup, demo order creation and AI-cache build (`npm run sandbox:*`, `npm run ai-cache:build`) |
| `tests/` | Unit, acceptance and (opt-in) sandbox tests |
| `docs/` | [Testing guide](docs/testing.md) and [honesty table](docs/honesty-table.md) |

## License

MIT — see [LICENSE](LICENSE).
