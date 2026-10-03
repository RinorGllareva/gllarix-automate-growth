# People › KPIs per role (`/kpis`)

**Job:** see every role against its targets, and decide whether to fix the script and list or talk to the person.
**Who:** founders.

## Today (audit 2026-10-03)
- **Works:**
  - role cards with KPI tables (this week / last week);
  - diagnostic line;
  - link to Hiring for roles nobody holds yet.
- **Missing:**
  - display-only;
  - targets are hard-coded in code;
  - only 2 weeks;
  - no drill-down to the person;
  - no history chart.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| KPI definition | Add a KPI to a role: name, formula (from a fixed list of metrics), unit, period | Role cards | Edit the name or formula; turn it on or off | Remove (history kept) |
| Target | Per role, optionally per person (ramp-up: e.g. week 1 at 50%) | Shown next to each value | Edit with an "effective from" date, so old weeks keep their old targets | — |
| Ramp plan | For a new hire: target % per week for the first 6 weeks | On the person's card | Edit | — |

**Views and sub-pages**
- **`/kpis`:** role cards with a period picker (week, month, quarter, custom). Each KPI cell clicks through to the records behind the number, e.g. "Meetings booked: 4" → those 4 meetings.
- **`/kpis/:role`:** a 12-week trend chart per KPI, per person, with the target line.
- **`/kpis/targets`:** the target editor with history.

**Metrics:** on-track count per role; the KPI furthest below target across the company.

**Automations**
- When a KPI is off target 2 weeks in a row, it's added to the person's next 1:1 agenda.
- Targets change only through this page. Reports, Today and the tracker all read the same targets.

**Priority**
- **P0:** drill-down links (person and records); period picker.
- **P1:** editable targets with effective dates; ramp plans.
- **P2:** custom KPI definitions; 12-week trends.
