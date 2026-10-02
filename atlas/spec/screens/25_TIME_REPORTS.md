# 25 — Time reports
**Route:** `/time/reports?month=&group=client|person|category` · **Mockup:** `TimeReports.dc.html` · **Milestone:** M13 · **Roles:** admin only (cost and margin columns); implementer (hours only, no money)

## Layout
- **Top bar:** "TIME REPORTS · <MONTH> · ADMINS"; primary EXPORT CSV.
- **Title** + a group switch: By client and project (default) · By person · By category.
- **4 KPI cards:**
  | Card | Shows |
  |---|---|
  | HOURS LOGGED | Total + split by person |
  | CLIENT WORK | Hours + % of all |
  | BILLABLE BY THE HOUR | Hours, with "custom software only" |
  | ESTIMATES | Actual vs estimate ratio |
- **Table (by client/project):** CLIENT OR PROJECT + sub-line (what, price basis) · TYPE (Arcadian, Gllarix, pre-sale, internal) · HOURS · REVENUE · PER HOUR · STATUS (HEALTHY ≥ target, OK, SALES, INTERNAL).
- **Right column:**
  - **RINOR · WEEKEND HOURS VS 12 H:** a bar chart for 4 weeks with a 12 h dashed line; bars over 12 h are coral; note "Feeds the profit-split rule for buying back Rinor's time".
  - **ESTIMATE ACCURACY · ACTUAL ÷ ESTIMATE:** per category.

## Behaviour
- **Revenue per hour:** revenue ÷ logged hours on that client or project. Fixed-price projects use the price; recurring clients use the monthly fees in the period.
- **Targets:** Gllarix setups ≥ $120/h; 3D projects ≥ €100/h after freelancer cost.
- **Margin** (admin): revenue − hours × `cost_rates` − direct costs (freelancer, usage).
- **Drill-down:** click a row to see its time entries.

## Endpoints
`GET /time/reports` · `GET /time/reports/export.csv`

## Acceptance criteria
- [ ] The sum of the rows equals the HOURS LOGGED card
- [ ] Per-hour values follow the formulas above
- [ ] The implementer never sees money columns
- [ ] Rinor's weekend chart uses only Saturday–Sunday entries in his timezone
