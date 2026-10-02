# 11 — Reports
**Route:** `/reports` (`?week=` or `?month=`) · **Mockup:** `Reports.dc.html` · **Milestone:** M4 (funnel, KPIs), M7 (MRR), M10 (gates) · **Roles:** admin; viewer (totals); BDR (own funnel only)

## Purpose
Show whether we're on track: the funnel, KPIs against targets, MRR against the €10k plan, and the stage gates.

## Layout
- **Top bar:** "WEEK 48 · 23–29 NOV" with a week/month switch; primary EXPORT (CSV of every table).
- **Row 1, left: weekly funnel (BDR, or choose a person).**
  - Horizontal bars: Dials → Connects → Conversations → Booked → Held → Won.
  - Count and step conversion % for each (e.g. 12%, 62%, 11%, 80%, 25%).
  - Widths are proportional; labels always shown.
- **Row 1, right: MRR against the €10k plan.**
  - A dashed lavender plan line (Dec €84 · Jan €565 · Feb €3,066 · Mar €4,535 · Apr €6,576 · May €8,818 · Jun €11,712).
  - A solid cyan actual line, with a dot on the current month.
  - Status chip AHEAD / ON PLAN / BEHIND (±10%).
  - Labels: actual, plan this month, plan in June.
- **Row 2, left: KPI table.**
  - Columns: KPI · this week · target · status chip (ON TRACK mint / WATCH amber / OFF TRACK coral).
  - KPIs from `context/03`: dials per day, conversations per day, meetings booked, show rate, approved/booked, CRM updated same day, close rate on held meetings (+ follow-up within 24 h).
- **Row 2, right: stage gates.**
  | Gate | Measure | Note |
  |---|---|---|
  | Gate 1 | 3 paying clients (x / 3) | "Then promote the BDR to closer and hire setter #1" |
  | Gate 2 | €2,000 MRR for 2 months | "Then add a second channel and an implementer" |
  | Gate 3 | €5,000 MRR, churn under 5% | "Then build pods" |

## Behaviour
- **Targets:** come from settings (seeded from `context/03`); admins can edit them in Admin › Settings.
- **Status rules:** ON TRACK when the target is met; WATCH within 10% of it; OFF TRACK otherwise.
- **Drill-down:** clicking a funnel bar or KPI opens the underlying list (e.g. booked meetings that week).
- **Caching:** computed by a job every 15 min; "updated x min ago".

## Endpoints
- `GET /reports`
- `GET /partials/reports/funnel`
- `GET /partials/reports/mrr`
- `GET /partials/reports/kpis`
- `GET /partials/reports/gates`
- `GET /reports/export.csv`

## Acceptance criteria
- [ ] Funnel numbers equal the counts in `activities`, `meetings` and `deals` for the week
- [ ] MRR is in EUR, with USD converted at the planning rate shown in a footnote
- [ ] The plan line matches `plans/mrr_10k_strategy.md`
- [ ] Gate progress updates when a client becomes paying
- [ ] The viewer sees no personal data beyond names and totals
