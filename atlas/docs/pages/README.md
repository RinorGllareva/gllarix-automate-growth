# Atlas: every page, what it does today, and what it must do

**Written:** 2026-10-03, after a full read-only audit of the code.
- **Each page spec covers:**
  - its job per role;
  - what works today and what's missing (with file references in the audit);
  - a create / read / update / delete table per entity;
  - sub-pages;
  - metrics;
  - automations;
  - integrations;
  - a P0/P1/P2 priority.
- **Read first:**
  - [00-PAGE-STANDARD.md](00-PAGE-STANDARD.md): one layout and one way of working for every page;
  - [01-INTEGRATIONS-AND-PLUGINS.md](01-INTEGRATIONS-AND-PLUGINS.md): how Atlas connects to everything.

## Page count per department

| App (department) | Pages | Specs |
|---|---|---|
| **Sell** | 9 | [Today](sell/today.md) · [Inbound](sell/inbound.md) · [Call workspace](sell/call-workspace.md) · [Leads](sell/leads.md) · [Pipeline](sell/pipeline.md) · [Meetings](sell/meetings.md) · [Deals and quotes](sell/deals.md) · [Clients](sell/clients.md) · [Reports](sell/reports.md) |
| **Work** | 6 | [Tasks and projects](work/tasks.md) · [AI planner](work/ai-planner.md) · [Support](work/support.md) · [Time tracking](work/time.md) · [Operations plan](work/operations.md) · [Docs and wiki](work/docs.md) |
| **Money** | 5 | [Finance](money/finance.md) · [Payments](money/payments.md) · [Financial plan](money/financial-plan.md) · [ROI and investment](money/roi.md) · [Prices and calculator](money/prices.md) |
| **People** | 5 | [Team performance](people/team.md) · [KPIs per role](people/kpis.md) · [Bonuses and commissions](people/commissions.md) · [Hiring](people/hiring.md) · [Training](people/training.md) |
| **Growth** | 4 | [Automations](growth/automations.md) · [Outreach cadences](growth/cadences.md) · [Marketing](growth/marketing.md) · [Market and competitors](growth/markets.md) |
| **AI** | 3 | [AI co-founder, BDR agent, performance tracker](ai/ai-pages.md) |
| **Total app pages** | **32** | |
| Settings | 11 sections | [settings.md](settings/settings.md) |
| Public (clients see these) | 6 | [public-pages.md](public/public-pages.md) |

**Sub-pages these specs add:** about 45, for example Finance › Subscriptions, Payments › Reconcile, Deals › Approvals, Leads › Duplicates, Pipeline › Forecast, Automations › Library, Cadences › :id, Tasks › Projects/Trash, Clients › Onboarding board. Each is a view or record page built from the shared components, not a new design.

## What the audit found (honest summary)

**"Nothing works" isn't accurate. "Every page stops half-way" is.**
Most pages already read and create real records in demo mode. The common pattern: you can **create but not edit or delete**, you can **see but not act**, and **business rules live in code** instead of in Settings. The worst cases:

1. **Business rules in code.** Targets, cadence steps, prices, scoring weights, commission plan, country rules, objection answers, positioning and SOP lists all need a developer to change. → P0/P1 across Settings, Prices, Cadences, KPIs, Training, Marketing.
2. **Missing update/delete.**
   - Expenses, cash snapshots;
   - lead company fields, contacts, notes;
   - meetings (no reschedule or cancel);
   - deals and quotes;
   - automations (no edit);
   - task templates;
   - candidates;
   - tickets (fields);
   - competitors.
3. **Dead ends for some roles.** The accountant clicks into Clients and Deals from Payments and Pipeline and gets "Forbidden". The implementer hits a Forbidden deal from Clients. "New deal" on Pipeline opens an error. Sellers can't see their own Reports, although the data allows it.
4. **Display-only pages.** Prices (no calculator), KPIs, Commissions (can't mark paid), ROI decisions (can't approve), Operations tables.
5. **Inconsistent layouts.**
   - KPI strips on 4 of 9 Sell pages.
   - Search on 2 of 9.
   - Three different brand-filter styles.
   - Hand-built tables on Meetings, Inbound and Reports.
   - Actions sometimes in the top bar, sometimes in the page.
   - → The page standard fixes this once.
6. **Everything external is simulated.** No real calling, email, Stripe, calendar, AI or storage yet (263 data functions still unwired for Supabase).

## Progress (2026-10-03, demo mode)

**Wave 1 foundations**
- **Done:**
  - Trash with soft delete, 10-minute undo for the deleter, and 30-day admin restore (Settings › Trash);
  - clickable metric tiles (`KpiCard` with `onClick`);
  - row menus (`RowMenu`);
  - the shared `DataTable` (custom-field columns that load late now get their default visibility);
  - **`ViewBar`** (`components/ViewBar.tsx`, `services/views.ts`): search, filter chips (select, date, number, text), saved views per person and page, shared views for founders. Used on Deals, Support, Payments, Finance expenses and Commissions;
  - **`RecordPage`** family (`components/record/Record.tsx`): `RecordPage`, `PropertyRow`, `ActivityTimeline`, `RelatedList`, `NextStepCard`. Every record page uses it: leads, deals, clients, meetings, tickets, candidates and docs. Tickets and candidates also open as a side panel from their list (`?open=:id`), and candidates have a full page at `/hiring/:id`;
  - **events table:** every write recorded in the audit log is also an event (reads and sign-ins aren't). It feeds the record timelines and Settings › Events. Outbound webhooks (https only, HMAC-SHA256 signed) record what they would send; demo mode never calls the URL;
  - **custom fields** (Settings › Fields) on leads, deals, clients, tickets and candidates: nine types, validation, edit in place on the record, table columns (Leads, Deals), filters (Deals, Support), and import mapping (candidates);
  - **Import Center** (Settings › Import): CSV, XLSX and JSON (a built-in .xlsx reader, no library); mappings saved per source; preview with duplicates; import; undo the whole batch. Covers expenses, candidates and tasks. Leads keep their own wizard, which now also reads XLSX/JSON, remembers mappings, and recognises HubSpot, Pipedrive and Apollo column names.
- **Limits, by design for now:**
  - Leads, deals, clients, meetings and docs open as full pages only (no side panel from their list yet).
  - Automations still fire from their own triggers, not from the events stream.
  - The `ViewBar` isn't on Leads (it has server-side filters and saved URLs) or on Tasks (it has its own views).

**Wave 2: P0 done on these pages**
- **Sell:**
  - Leads: new lead, edit company, contacts, notes, archive;
  - Pipeline: search, show lost, reopen;
  - Meetings: reschedule, cancel;
  - Deals: new deal with lead picker, edit owner and brand, delete, discount approvals;
  - Inbound: search and filters, reassign, reply note, undo dismiss;
  - Clients: edit contact, owner and plan; search and table; billing as a job; no Forbidden proposal links;
  - Reports: custom date range, drill-down, sellers' own funnel, gate 3 with churn;
  - Today: targets from KPIs, empty-state buttons, decide inline;
  - Call workspace: edit company and contact, full history.
- **Work:**
  - Tasks: editable property row, remove dependency, trash, list rename and archive menu, full new-task form;
  - Time: edit entries, notes, status labels, reopen dialog;
  - Support: search and filters, edit every field, reply emailed-to, attachments;
  - Operations: add, edit and delete SOPs; who ticked each item;
  - Docs: full-text search, archive with restore, reorder.
- **Money:**
  - Finance: edit and delete expenses and cash;
  - Payments: reminders, mark paid, filters;
  - ROI: agree, reject, keep or stop a spend;
  - Prices: calculator, turn into a quote;
  - Financial plan: saved scenarios, start month, several hires.
- **People:**
  - Commissions: statuses, bulk actions, filters;
  - Team: week picker, resolve disputes, edit and delete comments;
  - KPIs: period picker, drill-down;
  - Hiring: edit every field, delete, search, drag and drop;
  - Training: edit and cancel a program, remove scores, gate notes.
- **Growth:**
  - Automations: edit rules, choose space, list, assignee and link; template editor;
  - Cadences: create, duplicate and delete templates;
  - Marketing and Markets: channel and competitor create, update and delete.
- **AI:** rename and delete threads; "Ask about this" on leads, deals and clients.
- **Settings:**
  - Users: invite, edit, pause with hand-over;
  - company profile, which fills the contract placeholders;
  - commission rules.

**Still to do from the P0 lists**
- Queue settings beyond each person's daily queue size (call windows and the queue mix are still in `config/queue.ts`).
- Every new data function is demo-only. The Supabase source returns "not wired" until the matching migrations exist.

## Build order (what makes the job easier first)

**Wave 1: foundations (once, then every page benefits)**
- `ViewBar` (saved views, filters, sort, search) on every list.
- `RecordPage` with property row, activity, related, files and next step.
- `MetricTile` with click-to-filter.
- Trash with soft delete and undo.
- The events table that feeds automations and the audit log.
- Settings › Fields (custom fields).
- The Import Center.

**Wave 2: P0 on every page.** This is the "finish what's half-done" list:
- create, edit and delete everywhere;
- the dead links for each role;
- "+ New lead" and "+ New deal";
- reschedule and cancel meetings;
- mark commissions paid;
- approve ROI decisions;
- the calculator on Prices;
- edit automations;
- editable targets and company profile.

**Wave 3: real connections** (needs Supabase first):
1. Twilio;
2. Stripe;
3. email sending and reply capture;
4. Google Calendar;
5. Slack;
6. bank import;
7. accountant export.

**Wave 4: P1 sub-pages**:
- forecast, reconcile, approvals, subscriptions;
- cadence editor and stats;
- automations library;
- client onboarding board;
- docs versions.

**Wave 5: P2 and AI**:
- AI provider server-side;
- BDR agent live;
- briefings;
- client portal;
- public application page;
- plugins.

**Rule for every new feature from now on:**
1. It's an entity with a page job.
2. It's built from the shared components.
3. It has full create / read / update / delete.
4. It emits events.
5. Its business rules are editable in Settings.
6. It has a spec here before it's built.
