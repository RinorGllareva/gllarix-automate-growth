# Growth › Automations (`/automations`)

**Job:** see the hours Atlas gives back, and turn any step we repeat into a rule. This is the replacement for Zapier/Make and ClickUp automations.
**Who:** founders.

## Today (audit 2026-10-03)
- **Works:**
  - "Runs by itself" ledger (hours saved, 30 days);
  - task rules (one trigger, at most one condition, one action);
  - on/off;
  - delete;
  - task templates (read only);
  - run log.
- **Missing:**
  - **a rule can't be edited**: the API supports it, but the editor only creates new rules;
  - **task templates can't be created or edited** (the API exists, there is no UI);
  - the "create tasks" action is hard-coded to Delivery › Onboarding and the implementer;
  - only 4 triggers, all task- or deal-related;
  - no dry run;
  - no filtering or export of the run log;
  - no outbound webhooks;
  - no automation templates library.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Rule | **Builder**: WHEN (any event: lead.created, lead.stage_changed, inbound.received, meeting.booked/held/no_show, quote.sent/opened/expired, deal.won/lost, invoice.issued/late/paid, payment.failed, ticket.created/overdue, client.health_dropped, task.*, time.week_submitted; **or a schedule**: daily 08:00, every Monday, 1st of month) → IF (any number of conditions on the record: AND/OR, field operators, owner, brand, country, tier, amount) → THEN (one or more steps: create task/project from template, notify person/role/Slack, send email from template, set field, move stage, add to cadence, create ticket, call webhook, **ask the AI** to draft/classify, **wait** N hours/days, **approval** by a founder before continuing) | Rules list: name, trigger, last run, runs (30 d), hours saved, status | **Edit** everything; duplicate; on/off; rate limit; run as (system / a person) | Delete (with its history kept) |
| Run | Automatic | Log: time, rule, record, steps, result, error; filter by rule/status/date; **replay** a failed run | — | — |
| Template (task / project / email) | Create and edit here (shared with Tasks and Cadences) | Library | Edit | Delete |
| Webhook (outbound) | Pick events + URL; signed (HMAC) | Delivery log | Edit, pause | Delete |

**Views and sub-pages**
- **`/automations`:** "Runs by itself" (exists), then **Your rules** as a DataTable.
- **`/automations/new`** and **`/automations/:id`:** the rule builder as a full page:
  - a vertical flow (trigger → conditions → steps);
  - a **dry run** that shows the records it would have fired on in the last 7 days;
  - test it on one record.
- **`/automations/runs`:** run log with filters and replay.
- **`/automations/templates`:** task, project and email templates.
- **`/automations/library`:** ready-made rules to switch on in one click, for example:
  - inbound not answered in 15 minutes → alert founders;
  - quote not opened in 2 days → call task;
  - invoice 3 days late → reminder;
  - health below 60 → call task;
  - won → onboarding project;
  - new hire → training program;
  - Friday → submit-your-week reminder;
  - stale lead → nurture cadence.
- **`/automations/webhooks`:** outbound webhooks.

**Metrics:**
- hours saved (founders / BDR);
- runs this month;
- failed runs;
- rules on.

**Safety:**
- compliance checks run before any client-facing step (country rules, hours, opt-out);
- a rate limit per rule;
- founder approval steps for anything that spends money or messages a client in a new way.

**Priority**
- **P0:** edit rules; editable task templates; configurable "create tasks" target.
- **P1:**
  - full event list;
  - multiple conditions and steps;
  - schedule triggers;
  - dry run;
  - run log filters and replay.
- **P2:** library; webhooks; AI and approval steps.
