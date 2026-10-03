# Work › Time tracking (`/time`, `/time/reports`)

**Job**
- **Everyone:** log time without friction.
- **Founders:** know the hours per client and project, the margin per hour, and whether estimates hold.

**Who:**
- Admin, bdr, closer, implementer.
- Reports: admin, and the implementer (hours only).

## Today (audit 2026-10-03)
- **Works:**
  - timer;
  - manual entry;
  - week grid;
  - submit, approve and reopen a week;
  - delete an entry;
  - reports by client, person or category (sortable shared table);
  - CSV export;
  - weekend chart;
  - estimate accuracy.
- **Missing:**
  - an entry can't be edited;
  - notes aren't shown in the list;
  - the weekend chart label is hard-coded to Rinor;
  - reports cover only 6 months, with no range or person filter;
  - time projects and invoice items exist in the data layer but have no UI;
  - the timesheet status shows as raw text;
  - time can't be turned into an invoice.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Time entry | Timer, manual, grid cell (exist); **from the calendar** (meetings become entries with one click); from a task (exists) | Week grid + **entries list with notes** | **Edit** (hours, day, target, category, billable, note) until the week is approved | Delete (exists) |
| Timesheet | Automatic per week | Status chip | Submit / approve / reopen (exist, the reopen comment in a proper modal) | — |
| Time project | **"+ Project"** for non-task work (internal, R&D, client retainer) with a budget in hours | Projects list: budget vs logged | Edit budget, rate, billable default | Archive |
| Billable hours → invoice | "Bill these hours" on a client → invoice items for the month | Unbilled hours per client | — | Remove an item before the invoice is issued |

**Views and sub-pages**
- **`/time`:** my week (exists), with an entries list under the grid.
- **`/time/reports`:**
  - any date range;
  - filters for person, client, project and billable;
  - charts per week;
  - the "weekend hours" chart per person, not hard-coded.
- **`/time/projects`:** budgets and burn.
- **`/time/approvals`:** founders approve everyone's weeks in one place.
- **`/time/billing`:** unbilled billable hours per client → create invoice items.

**Metrics:**
- hours this week vs capacity;
- billable %;
- revenue per hour per client;
- estimate accuracy;
- unbilled hours (€).

**Automations**
- **Friday 15:00:** "Submit your week" reminder.
- **Monday:** unapproved weeks go to the founders.
- **Timer running over 3 h:** "Still working on X?"
- **Task moved to Done:** "Log time?" (exists).

**Integrations:** Google Calendar (meetings → entries); invoices (billable hours → Stripe invoice items); payroll export for contractors (approved hours × rate).

**Priority**
- **P0:** edit entries; show notes; proper status labels; reopen modal.
- **P1:** report range and filters; projects with budgets; approvals page.
- **P2:** billing of hours; calendar import; contractor payout export.
