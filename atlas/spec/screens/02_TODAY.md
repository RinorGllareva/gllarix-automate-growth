# 02 — Today
**Route:** `/today` (default after sign-in) · **Mockup:** `Main.dc.html` · **Milestone:** M3 · **Roles:** all; the content adapts per role

## Purpose
Answers "what do I do now?" for each person: queue progress, KPIs, the next leads in the current calling window, and what needs attention.

## Layout
1. **Header:**
   - label "TODAY'S QUEUE";
   - big number `done of capacity`, e.g. "62 of 150" (56 px, weight 300);
   - progress bar (460 px) with "41% done · on pace for 150 by 15:40 VET" and "88 left".
2. **KPI row (4 cards):**
   | # | Card | Shows |
   |---|---|---|
   | 01 | Dials | Today's count, "TARGET 150 TODAY" |
   | 02 | Conversations | Count (mint when within 6–10), "TARGET 6–10 · ON TRACK / BELOW" |
   | 03 | Meetings booked | This week, "TARGET 4+" |
   | 04 | Approved | This week, "OF n BOOKED · x%" |
3. **Up next (left, ~2/3):**
   - Header "UP NEXT · <WINDOW NAME> <hours> LOCAL" + link "OPEN FULL QUEUE ↗".
   - Rows (52 px): tier badge (A80), company, city/state, local time, "why now" (top scoring signal), step (DAY 1 · CALL, CALLBACK, OPENS 08:00 ET).
   - Clicking a row opens `/call/{lead_id}`.
   - Shows the next 6–10 tasks in queue order.
4. **Right column:**
   - **Queue mix:** calls / emails / follow-ups, with counts and bars.
   - **Needs attention:** callbacks due within 30 min (time + company), meetings waiting for approval, lead shortfall for tomorrow, plus a "RUN LIST BUILD" button that goes to Import or triggers the list-build job (admin).

## Data
- `tasks` where `owner = me` and `queue_date = today`, ordered by the queue builder's `position`.
- KPIs from `activities` (today) and `meetings` (this week).
- Shortfall from the queue summary produced by `services/queue.py`.

## Role variants
| Role | What changes |
|---|---|
| BDR | As above |
| Co-founder | Capacity 80; the mix shows LinkedIn tasks and emails; windows are Dubai, then UK and CH mornings |
| Admin without a capacity | The KPI row shows the team totals; "Up next" is replaced by "Today's priorities": the top 5 tasks due today from Tasks, plus pending approvals |
| Phone (≤ 480 px) | Header and KPIs stacked; Up next as cards |

## Behaviour
- **Refresh:** every 60 s for KPIs and attention (HTMX polling); the queue refreshes when an outcome is logged elsewhere (`HX-Trigger: queue-updated`).
- **Primary action:** START CALLING opens `/call` with the first queue item.
- **Queue not built yet** (before 05:00 local): show "Your queue is being built at 05:00" and a BUILD NOW button (admin, or the owner).

## States
- **Empty queue:** "No calls due. Build tomorrow's list or check Tasks."
- **Shortfall > 0:** amber line in Needs attention.

## Endpoints
`GET /today` · `GET /partials/today/kpis` · `GET /partials/today/next` · `POST /queue/build` (owner/admin)

## Keyboard
`C` start calling · `R` refresh

## Acceptance criteria
- [ ] The numbers match the seeded activities exactly
- [ ] The rows are in the same order as the call workspace queue
- [ ] Callback items due within 30 min appear at the top of Needs attention
- [ ] It works at 390 px width
