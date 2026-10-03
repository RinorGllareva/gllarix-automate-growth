# Sell › Pipeline (`/pipeline`)

**Job:** see every open deal by stage, move them forward, and spot where deals get stuck.
**Who:**
- Admin, bdr, closer: move deals (sellers only their own).
- Accountant: read the pipeline value.

## Today (audit 2026-10-03)
- **Works:**
  - kanban of all stages except lost, with a count and setup sum per column;
  - brand and owner filters;
  - won-earlier toggle;
  - move by drag or Shift+arrows;
  - lost needs a reason, and won without a deposit needs an admin override.
- **Missing:**
  - lost deals are never shown and can't be reopened;
  - no search;
  - no list view;
  - no metrics;
  - "New deal" in the header opens an error page (no lead chosen);
  - the accountant's card links go to a page they can't open;
  - no age or "stuck" indicator;
  - fixed card order.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Deal (card) | "+ New deal" → **pick a lead** (search) or **create a lead inline** → deal builder | Board + **table view** (same filters) + **forecast view** | Drag between stages; inline owner, expected close date, value; card menu (open, log activity, mark lost/won) | **Lost** column/filter and **reopen** a lost deal; delete (founders) a deal created by mistake (no quotes) |
| Stage | In settings: name, order, probability %, exit criteria, BDR may move into it (yes/no) | Columns | Edit, reorder, WIP limit | Delete if empty |

**Views and sub-pages**
- **`/pipeline`:** the board. Each card shows:
  - company and contact;
  - value;
  - days in stage, coral past the stage's limit;
  - next step;
  - owner.
  - Sort inside a column: value, age, expected close.
- **`/pipeline?view=table`:** the same deals in a DataTable with every column.
- **`/pipeline/forecast`:** weighted pipeline by month (value × stage probability) vs the plan's MRR line.
- **`/pipeline/lost`:** lost reasons chart; reopen.

**Metrics:**
- open pipeline (setup + monthly);
- weighted forecast this month;
- win rate (90 days);
- average sales cycle;
- deals stuck past the stage limit.

**Automations**
- **Stuck in a stage past its limit:** a task for the owner, and the card turns coral.
- **Moved to Won:** onboarding (exists), commission lines, a celebration in Slack.
- **Moved to Lost:** reason required; re-engage in 90 days (an automatic nurture cadence).

**Access fix:** the accountant gets a read-only deal panel (no internal margin) instead of a Forbidden link.

**Priority**
- **P0:** "New deal" with lead picker; the accountant's link fix; search; lost view and reopen.
- **P1:** table view; days in stage and stuck indicator; metrics strip.
- **P2:** forecast; stage settings with probabilities.
