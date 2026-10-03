# Money › Financial plan (`/plan`)

**Job:** test a hire, a price change or a slow month before deciding, with the cash curve in front of you.
**Who:** founders.

## Today (audit 2026-10-03)
- **Works:**
  - scenario (worst, realistic, best);
  - sales pace;
  - fee;
  - churn;
  - "start from cash" toggle;
  - one hire;
  - MRR, revenue and cash charts;
  - stage gates;
  - month-by-month table.
- **Missing:**
  - nothing is saved;
  - start month is hard-coded (Oct 2026);
  - only one hire can be modelled;
  - no export;
  - founder pay, tax and VAT are excluded;
  - no comparison between scenarios.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Scenario | "Save as…" from the current inputs (name, note) | List of saved scenarios; open any; compare up to 3 side by side | Edit inputs, rename, mark one as "Plan of record" (feeds targets and Reports) | Delete (not the plan of record) |
| Assumption line | Add: a hire (role, start, monthly cost, ramp), a price change (from month, new fee), a one-off cost, a funding event, a churn shock | Timeline of assumptions under the chart | Drag on the timeline or edit the fields | Remove |
| Actuals | Automatic: MRR, cash and costs from Finance and Payments | "Plan vs actual" overlay per month | — | — |

**Views and sub-pages**
- **`/plan`:** the planner, with the assumption timeline, charts and table.
- **`/plan/compare`:** 2–3 scenarios on one chart, with a table of differences (cash low point, month MRR passes €10k, runway).
- **`/plan/:scenarioId`:** a shareable scenario page that is read-only for the co-founder until they open it in edit mode.

**Metrics**
- Month when MRR passes €10k.
- Lowest cash and the month it happens.
- Runway at the end of the plan.
- Gate dates: 3 clients, then €2k MRR for 2 months.
- Plan vs actual for this month.

**Automations**
- When actuals drift more than 15% under the plan of record for 2 months in a row, alert the founders, add a line in "Needs a founder", and suggest the "slower" scenario.
- When a gate is reached, the founders get a task to decide on the next hire.

**Integrations**
- Export to XLSX with formulas, for the bank or an investor.
- The AI co-founder reads the plan of record when answering money questions.

**Priority**
- **P0:** save and load scenarios; set the start month; several hires.
- **P1:** compare view; plan vs actual; XLSX export.
- **P2:** tax, VAT and founder pay lines; drift alerts.
