# 09 — Deal and quote builder
**Route:** `/deals/{id}` · `/deals/new?lead={id}` · `/deals` (list, simple table) · **Mockup:** `Deal.dc.html` · **Milestone:** M6 · **Roles:** admin (full); closer (discount ≤ 10%); BDR (price book only, no extra discount)

## Purpose
Build a quote from the price book with the same maths as the calculator, send it, get it accepted and take the deposit.

## Layout
### Left
- **Label:** "QUOTE vN · PRICE BOOK V2 · VALID UNTIL <date>". Title = company.
- **Options row:**
  - Market segmented control: US and Canada · W. Europe · Switzerland · Kosovo (and Gulf when added); defaults from the company's country.
  - Pilot checkbox, with "n of 2 left" for the brand; disabled when 0 are left.
  - Rush +25%.
  - Annual prepay.
  - Extra discount: admin/closer only, ≤ 10%; more needs an approval request.
- **Line items table:**
  - Columns: BRAND chip · ITEM + one-line note · QTY · SETUP · MONTHLY.
  - "+ Add from price book" opens a picker with tiers and add-ons. Picker rules:
    - `requires` disables items until their prerequisite is chosen;
    - `included_with` shows "Included";
    - `max_qty` caps the quantity.
- **Adjustments list**, in the order of `services/pricing.py`: List subtotal · Market · Bundles (Never Miss a Job −10% Gllarix monthly; landing page with Gllarix −20% page setup) · Rush · Pilot (setup ×40%, monthly −25% for 12 months) · Extra discount · **Final (setup rounded to 10)**.

### Right
- **Totals card:**
  - SETUP FEE (36 px mint) with "50% now · 50% at launch";
  - MONTHLY (cyan) with "first month free" for pilots;
  - first-year value · minutes included · overage rate · BDR commission (the closer's commission for closers) · extra discount status.
- **Buttons:** SEND DEPOSIT LINK (primary; Stripe Checkout for 50% of setup) · DOWNLOAD QUOTE PDF.
- **Quote status timeline:** Quote sent · Opened by client · Terms accepted · Deposit paid (with times).

## Behaviour
- **Recalculation:** every change re-runs `services/pricing.py` on the server and swaps the totals partial (< 300 ms).
- **Versions:** saving creates a new quote version; sent versions are immutable.
- **Send:** emails the client (compliance check) a link to the quote page.
- **Public quote page** (`/q/{token}`, no login):
  - the summary, inclusions, exclusions, usage caps and terms;
  - ACCEPT (name + checkbox; IP and time recorded);
  - pay deposit (Stripe Checkout).
- **Stripe webhook** `checkout.session.completed`:
  - payment recorded; deal → Won; client created (file 10);
  - commission rows created (pending until cash is collected and the 30-day clawback window passes).
- **Pilot counter:** decrements on Won; pilots are capped at 2 per brand.

## Parity tests (must pass)
| Case | Setup | Monthly | First-year value |
|---|---|---|---|
| US · Standard + speed-to-lead + reviews + conversion page · pilot | $1,780 | $786 | $10,426 |
| Same without pilot | $4,440 | $1,048 | — |
| Kosovo · interactive 3D building | €3,250 | €125 | — |
| Switzerland · 3D sales platform | €15,000 | €561 | — |

## Endpoints
- `GET /deals` · `GET /deals/{id}` · `POST /deals`
- `POST /deals/{id}/items` · `DELETE /deals/{id}/items/{item}` · `PATCH /deals/{id}/options`
- `POST /deals/{id}/quotes` (version) · `POST /quotes/{id}/send` · `GET /quotes/{id}.pdf`
- `GET /q/{token}` · `POST /q/{token}/accept`
- `POST /webhooks/stripe`

## Acceptance criteria
- [ ] All parity tests pass, and match `pricing/price-calculator.html`
- [ ] The BDR can't add an extra discount (no field in the HTML; the server rejects it)
- [ ] Accepted and paid quotes can't be edited
- [ ] The webhook is idempotent (replaying the same event does nothing new)
- [ ] The quote PDF shows prices excl. VAT, inclusions, caps and client-paid costs
