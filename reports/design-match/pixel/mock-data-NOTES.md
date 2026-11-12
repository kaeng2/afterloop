# mock-data — mockup copies with the app's data

Source: `afterloop/docs/design/mockup-v4/` (byte-identical to `scratchpad/mock/`), copied with `support.js`,
`vendor/react*.js`, `scene3/assets/`. Only data values are changed (JS data constants, plus a few
text literals that hold IDs/counts/percentages). Layout, CSS, and element structure are unchanged.
The app text was read from http://localhost:3111 on 2026-11-12 with Playwright innerText
(`../probe/app-*.txt`). Desk patches can be replayed against a fresh copy with `../patch_desk.py`.

States: Desk = `/?item=PP-R-GMS-10197661` default, Scene 1 = `/intro`, Scene 3 = `/listing` initial form.

## Scene 1 — `scene1/Scene1.dc.html`
| Where | Mockup | App |
|---|---|---|
| nav "Resolution Center" chip (markup literal) | 3 | 2 |
| DisputeLess icon badge (markup literal) | 3 | 2 |
| `PV.en.coach` | 3 cases need a reply… | 2 cases need a reply… |
| `PV.en.balT` | PayPal balance | Balance |
| `PV.en.rcOpen` | 3 open | 2 open |
| `cases[0].s` / `.due` | …· PP-D-20002 / Respond by Nov 12 · mentions chargeback | …· PP-R-GMS-10197661 / Respond by Nov 30 · mentions chargeback |
| `cases[1].s` / `.due` | …· PP-D-20001 / Respond by Nov 19 | …· PP-R-MBJ-10197650 / Respond by Nov 29 |
| `cases[2]` (Lena K. inquiry $24) | present | removed (app lists 2 cases) |
| `PV.en.rcCta` | Handle all 3 with DisputeLess | Handle all 2 with DisputeLess |

Already equal: activity list, balance, sales bars (heights checked), greeting, sales line.

## Scene 3 — `scene3/Main.dc.html`
| Where | Mockup | App |
|---|---|---|
| `LI.en.store` (and `LI.ko.store`) | Knot & Co. | Fernwood Knits |
| store logo letter (markup literal) | K | F |
| avatar initials (markup literal) | SM | FK |

Already equal: every form value (name, $89, 200, sale dates 2026-11-20/2026-12-02, description, sizes,
shipping, empty returns), the photo alt texts, and the nav labels.

## Desk — `Desk.dc.html` (`DI.en` unless noted)
| Where | Mockup | App |
|---|---|---|
| `dateLine` | Tue, Nov 10 · Black Friday in 17 days | Wed, Nov 11 · Black Friday in 16 days |
| `pname.beanie` | Beanie + Scarf | Beanie + Scarf Set |
| `prodSum` open-case count | open items (7) | fixed 3 (the app counts 3; its inbox has 5 items) |
| `dashS` | What AI handled for you | What's on your desk |
| tile 1 label / value / sub | Disputes prevented / 4 / this week | Open disputes / 3 / real PayPal sandbox cases |
| tile 2 | Money kept / $312 / refunds & chargebacks avoided | Money you can keep / $68 / vs refunding every case |
| tile 3 | Replies drafted by AI / 18 / in 4 languages | Replies drafted by AI / 3 / checked by code before sending |
| tile 4 | First reply time / 14 min / was 2 days | (empty label/value) / Nothing goes to PayPal without your approval. |
| `DASH0` | {4, 312, 18, 14} | {3, 68, 3, 0} |
| `ITEMS` | 7 items: #1042 Seo-yeon, #1038 Ji-ho, #1029 Lena, 5-order tracking, 3-order customs ID, #1051 Yuki, #1047 buyer_m | 5 items: PP-R-GMS-10197661 Seo-yeon (high, Reply by Nov 30), PP-R-MBJ-10197650 Ji-ho (Reply by Nov 29), "2 orders" Missing tracking, "Knit Cardigan" Black Friday stock, PP-R-FYT-10197651 Mike Morgan (repeat claim) |
| severity dots | jiho med (navy) | jiho, stock, mike low (grey); tracking med (navy) |
| `who.trk` | Shipped 3+ days ago · 4 countries | 2 orders shipped 3+ days ago have no tracking in PayPal. |
| new `who.stock` / `who.mike`, `cats.stock` | — | 120 left · fixes cut likely loss by about 80% / Mike Morgan · US / Black Friday stock |
| new `other.stock`, `other.mike` | — | placeholders, only shown if those items are clicked |
| case h1 (markup literal) | #1042 · Wool Sweater | PP-R-GMS-10197661 · Wool Sweater |
| `opened` | Open 23 days | Open 2 days · Waiting for your reply |
| `hist` (8 events) | Oct 19…Nov 9 seller-mistake story, p .05→.89 | Oct 17 Order paid, Oct 18 Shipped, Oct 18 No tracking number in PayPal, Oct 21 In transit, Oct 30 Customs hold, Nov 2 Buyer asks, Nov 10 Buyer threat, Nov 10 Dispute opened; p = .02,.02,.02,.02,.02,.029,.80,.80 and dot colours read from the app's SVG/title dots |
| history day count (literal in `renderVals`) | 23 | 26 |
| "89% → x" (markup literal) | 89% | 80% |
| `histSum` | Your Nov 5 promise was missed… | Seo-yeon asked twice with no reply while the parcel sits in customs hold… |
| `convS` | Original, in Korean · AI translation below | Original, in Korean · translation below |
| `msgs[0]` | 일주일째 그대로예요… / Nov 2 / tags Asks for update, Worried | 며칠째 '통관 보류'에서 그대로예요… / Nov 2 / no tags |
| `msgs[1]` | short threat / Nov 9 | full app Korean + English text / "Dispute message" |
| `paths.ai` | Ask for her customs ID / Customs releases it 1–2 days… / short draft | Reply with the facts / Explain what happened and ask for what's needed. / app's English draft (with line breaks) and the app's Korean text |
| `paths.carrier` t / how | Ask the carrier to check / The carrier can't release it… | Offer a partial refund / Not offered for this case type (your policy) |
| `paths.refund` t / how | Refund now / Ends it today. You lose $72. | Refund in full / Ends it now. You lose the order. |
| `costShort` | cost ~$x | expected loss ~$x |
| `replyS` | …her reaction updates as you type | …the forecast updates as you type |
| `sheSees`, `likely`, `moodNext`, `moodNow` | She'll see (Korean), Her likely reaction, Her mood next, now: angry | Seo-yeon will see (Korean), Seo-yeon's likely reaction, Mood next, now: Angry |
| `fx` labels | Why it's held (curly), Her next step, Refund backup | Why it's held, Next step for the buyer, **Buyer's language** (put on the `backup` slot so the 5th "good" chip matches) |
| forecast numbers | mockup's own model: risk 8%, paths 8%/$15 · 57%/$60 · 2%/$72, 82/10/8, mood Okay | the app's: risk 40%, Reply 40%/$37, Refund 3%/$74, 60/0/40, cost $37, mood Annoyed. Done by a new `APP_FC` table keyed by draft text, used by `fc()`. It also sets which checks are "good" for the app draft, so no "Vague timing" or "Missing" lint rows appear |

## Could not match (left as-is; these show up as diff regions)
- **Documented app-only elements** (left on purpose): "Demo mock — not a real…" banner (Scene 1/3), "Public demo · simulated sends",
  PayPal activity button, EN/한국어 switch, "H" avatar + account name (Desk header), "Demo data"/"Assumption" badges,
  "Simulated send — nothing goes to PayPal", the "Today" heading, sr-only lines. The Scene 1 "PayPal" wordmark is replaced by "Seller dashboard" in the app.
  The Scene 3 "P" icon is gone from the PayPal payments nav item.
- Desk dashboard: the mockup has an "AI" chip where the app has "Demo data". Tile 4 in the app is a text-only note, but the mockup still has the label/value lines (now empty).
- Desk "Black Friday stock" item: the mockup always renders "order · product", so it shows "Knit Cardigan · Knit Cardigan". The app shows only "Knit Cardigan".
- Desk middle path ("Offer a partial refund"): the app shows no chargeback/loss line and greys the card out. The mockup still prints a model value (Chargeback 57% · expected loss ~$60).
- Desk first buyer message: the app shows no "AI read" row. The mockup still prints the "AI read" label (with no tags). The app also puts the AI-read tags only under the 2nd message.
- Desk risk-curve x-axis labels (Oct 17 / Oct 21 / Nov 2 / Nov 10 / Your draft): the mockup draws them and the app has none.
- Desk Korean preview: the app keeps line breaks (pre-line). The mockup collapses them into one paragraph.
- The app's chargeback-word underline in the Korean message (카드사에 이의제기) is markup the mockup doesn't have.
- Layout differences (not data): app header height (+~25px on Desk), left column width, the scene banner offset, and textarea sizes. These shift everything below, so the diff regions are large.

## Control-tower patches (2026-11-12 round 2)
- First buyer message: `hasTags` now false when there are no tags (app shows no empty "AI read" row) — data-only.
- List item order number: `white-space:nowrap; flex-shrink:0` so long real dispute IDs don't wrap (same accommodation as the app; the mockup's IDs are short).
