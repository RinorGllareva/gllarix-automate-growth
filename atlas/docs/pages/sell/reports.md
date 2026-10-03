# Sell › Reports (`/reports`)

**Job**
- **Founders:** see if the business is on plan (funnel, MRR, gates) and where it leaks.
- **Accountant:** the monthly numbers.
- **Sellers:** their own funnel. The data layer already allows this, but the menu doesn't.

**Who:** admin, accountant. Add bdr and closer (their own data).

## Today (audit 2026-10-03)
- **Works:**
  - week / month with previous and next;
  - person select (admin);
  - funnel;
  - MRR vs the €10k plan;
  - KPI table;
  - stage gates;
  - daily BDR report;
  - CSV export.
- **Missing:**
  - gate 3 is hard-coded "not met", with a stale note;
  - no custom date range;
  - no brand filter;
  - no pipeline metrics (win rate, cycle time, lost reasons);
  - no drill-down;
  - no date picker for the daily report;
  - sellers can't open it;
  - no saved or scheduled reports.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Report (saved) | "Save this report" (filters, period, sections) | My reports / shared reports | Rename, change filters | Delete |
| Scheduled report | "Email this every Monday" to chosen people | Schedule list | Edit recipients and time | Stop |
| Widget | Add a section from a library (funnel, MRR, win rate, cycle time, lost reasons, source ROI, activity heatmap, cohort retention) | Report page | Reorder, resize, set its filter | Remove |

**Views and sub-pages**
- **`/reports`:** Overview, as today, with any date range, brand, list and person. Every number clicks through to the records behind it.
- **`/reports/sales`:**
  - win rate;
  - cycle time per stage;
  - lost reasons;
  - quote → paid conversion;
  - average deal by package and market.
- **`/reports/activity`:** dials, connects and conversations by hour and weekday (best calling times per market).
- **`/reports/sources`:** leads → meetings → clients per source, list and channel, with cost (from Marketing).
- **`/reports/clients`:** MRR movements (new, expansion, contraction, churn) and cohort retention.
- **`/reports/daily`:** the daily BDR report with a date picker.

**Metrics:** these come from the KPIs page targets. A single metrics service feeds Today, Reports, KPIs and the tracker, so numbers never disagree.

**Automations**
- **Monday 08:00:** the weekly report emailed to the founders.
- **1st of the month:** the monthly report to founders and the accountant.
- **A gate is reached:** a notification and a decision task.

**Priority**
- **P0:** fix gate 3; sellers' access to their own funnel; date range; drill-down.
- **P1:** sales and sources reports; daily report date picker.
- **P2:** saved and scheduled reports; widgets; cohorts.
