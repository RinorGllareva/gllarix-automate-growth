# 07 — Pipeline board
**Route:** `/pipeline` · **Mockup:** `Pipeline.dc.html` · **Milestone:** M4 · **Roles:** admin (all); BDR (own deals; can move up to Proposal sent); viewer (read-only)

## Purpose
See every open deal by stage, and move deals forward.

## Layout
- **Top bar:** context "OPEN PIPELINE · $x + €y SETUP" (separate totals per currency); primary NEW DEAL.
- **Title row:** "Pipeline" + brand filter segmented control (Both brands · Gllarix · Arcadian), plus filters: owner, market, created date.
- **7 columns:**
  | Column | Shows |
  |---|---|
  | QUALIFIED | Count + setup sum (per currency) |
  | MEETING BOOKED | Count + setup sum |
  | MEETING HELD | Count + setup sum |
  | OPPORTUNITY | Count + setup sum |
  | PROPOSAL SENT | Count + setup sum |
  | NEGOTIATION | Count + setup sum |
  | WON · <month> | Count + "MRR $x" |
- **Card:** brand chip · company · value "setup + monthly/mo" (+ "pilot") · owner · age in stage or the next date. Click → `/deals/{id}`.

## Behaviour
- **Drag and drop between columns:**
  - updates `deals.stage` and writes an activity on the lead;
  - **Won** requires a paid deposit or an admin override with a reason;
  - **Lost** opens a reason picker (price, timing, no need, competitor, no response, other + note).
  - The BDR can't move beyond Proposal sent.
- **Stale:** cards older than 14 days in a stage show an amber age.
- **Keyboard:** arrow keys move focus between cards; `Shift` + arrows moves the card.
- **Won column:** current month only; a link to see earlier months.

## Endpoints
`GET /pipeline` · `PATCH /deals/{id}/stage` · `GET /partials/pipeline/column/{stage}`

## Acceptance criteria
- [ ] Column sums equal the sum of the cards, per currency
- [ ] Dragging persists, and every change is in the audit log
- [ ] Won without a deposit is blocked for non-admins
- [ ] Lost requires a reason
- [ ] The brand filter changes the cards and the totals
