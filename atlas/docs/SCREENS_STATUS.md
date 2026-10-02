# Screens status

| Screen | Spec | Status | Gaps |
|---|---|---|---|
| Shared layout: sidebar, top bar | 00_SHARED_LAYOUT | Done | Running-timer strip on every page (M13) |
| Sign in | 01 | Done (demo) | Magic link and invite flow need Supabase (Q1) |
| Command palette | 13 | Partial | Pages, actions, recents and lead search (company, phone in any format, domain) work; deals, clients, tasks and meetings join as those modules land |
| Notifications panel | 13 | Done (demo) | Real events arrive with M4; email delivery preference later |
| Style guide | 14 | Done | |
| Admin shell | 12 | Partial | Users and roles (read-only), Settings (branding editable), Cadences (templates), Opt-out list, Integrations (email) and Audit log work; country rules, scoring, price book and jobs ship with their milestones |
| Admin › Opt-out list | admin/07 | Done (demo) | CSV import of opt-outs; second-admin approval for removing complaint/legal entries (blocked for now) |
| Today | 02 | Done (demo) | "Today's priorities" for admins shows the team view until Tasks (M9) |
| Call workspace | 03 | Done (demo, fake telephony) | Real Twilio calling and caller-ID pool; offer prices (M6); email and demo line (M5); "lead being worked by someone else" warning; script and objection answers are drafts until the co-founder writes them |
| Leads list | 04 | Done (demo) | "+ Filter" for any field, saved filters per user, add-to-cadence (M3); offset paging instead of cursor (fine in demo, cursor in Supabase mode) |
| Lead detail | 05 | Partial (demo) | Timeline, contacts, signals, stage/owner edits, score card work. Add/edit contact, tags, files, live compliance card (done in M2), suggested offer (M6), re-enrich (M8) |
| Import leads | 06 | Done (demo) | Runs in the browser rather than as a background job; mapping templates per source not saved yet; cadence on import (M3) |
| Pipeline board | 07 | Done (demo) | Market and created-date filters; cards open the deal builder |
| Meetings and approval | 08 | Done (demo) | Booking link button and calendar invites (M5); meeting detail page; reopening a closed month |
| Reports | 11 | Done (demo) | Drill-down from bars and KPIs; 15-minute cached job; editable targets in Admin › Settings; churn for gate 3 (M7) |
| Deal and quote | 09 | Done (demo, fake Stripe) | Real Stripe test keys (Edge Function + signed webhook); real PDF (print-to-PDF for now); quote opened/viewed notifications by email |
| Clients and usage | 10 | Done (demo, fake voice platform + fake Stripe) | Real UsagePortal (voice platform API) and Stripe subscriptions/invoice items in Edge Functions; support tickets for the health score; a real PDF (print-to-PDF for now) |
| Tasks list, board, detail | 15–17 | Done (demo) | Split with AI and the planner note (M11); recurring tasks; swimlanes; GitHub PR card. 2026-10-01 layout change: the spaces sidebar is now a tab row (My work, Inbox, spaces), with the space's lists as chips; there's one icon view row with the filters and New task; the board and task page use the Notion style (rounded tinted columns, emoji + bold title, property row, View details, comments above the description). The main sidebar can collapse (remembered in `atlas-sidebar-collapsed`). |
| Timeline and workload | 18–19 | Done (demo) | Swimlanes; AI re-plan suggestions (M11) |
| AI planner | 20 | Done (demo, fake AI provider) | Real Anthropic provider in the "planner" Edge Function |
| Team performance, scorecard, call review | 21–23 | Done (demo, fake transcription + coach) | Real transcription and coach Edge Functions; real audio player with signed URLs; GitHub stats for the Codex agent |
| Time, time reports | 24–25 | Done (demo) | Weekly grid, global timer, submit/approve/reopen; reports by client, person, category |
| AI co-founder | 26 | Done (demo) | Threads, board memos, data it used, assumptions, Accept; Monday briefing, month-end close, alerts; Admin › AI co-founder and finance |

Every placeholder route already enforces role access (403 for forbidden roles) and appears in the sidebar and `G` shortcuts only for roles allowed to see it.

## Supabase mode
Lead methods are not wired to Supabase yet (they show a clear error). The M1 migration (`20261001000200_m1_leads.sql`) is ready; once it's applied, the lead API gets its Supabase implementation.

## Pulled forward from M2
- Scoring (`src/services/scoring.ts`, Appendix 1) runs on seed, import, contact changes, outcomes and rescore.
- `compliance.canContact` (`src/services/compliance.ts`) runs in the queue builder and the call workspace: opt-out list, stage, country channel rules, calling hours in lead-local time, 3 attempts per 10 business days.
- The rest of M2 is done (see M2 notes below).

## M3 notes
- Queue builder: `src/services/queue.ts` (A9). After the shift ends it builds the next business day's queue, like the 05:00 job.
- Outcomes: `src/services/outcomes.ts` (A7), each creating exactly one next action on the lead.
- Telephony: `TelephonyProvider` with a fake provider (`src/services/telephony.ts`); no real calls are ever placed.
- Not yet: co-founder channel mix (`cofounder_mix`), cadence editor (admin/05), email sending (M5).

## M4 notes
- Commissions: `src/services/commissions.ts` ($15 per approved meeting, pending → earned when the month closes). Setup and recurring commission arrive with payments (M6).
- Reports: `src/services/reports.ts` (funnel, KPIs vs context/03 targets, MRR vs the €10k plan at 1.15 USD/EUR, gates); daily BDR report built after each shift with rejection reasons.
- Database: `supabase/migrations/20261001000300_m4_sales.sql` enforces the 6 checks, reject reasons, Won-needs-deposit-or-override, Lost-needs-reason, BDR stage limit and month lock in Postgres too.

## M5 notes
- Email: `EmailProvider` with a fake mailbox (`src/services/emailProvider.ts`); the Gmail API version runs server-side (Edge Function + Vault OAuth tokens) once Supabase is connected.
- Sender: `src/services/emailSender.ts` decides send / wait / block / cancel per message: opt-out list, country rules (cold only), stop stages, lead-local send window, 3-day gap, footer address, unfinished `[TO WRITE]` placeholders, per-inbox warm-up caps.
- Reply detection stops the cadence (stage Replied, cold emails cancelled, follow-up call next business day).
- Unsubscribe: public `/u/:token`, one click, writes the opt-out list.
- Booking: public `/book/:slug` (e.g. `/book/diego`), creates or matches the lead, books the meeting, opens the deal, queues the confirmation and reminders.
- Not yet: real Gmail and calendar invites (.ics), LinkedIn tasks can't be ticked off yet, AI-drafted first lines (O4), email open tracking.

## M6 notes
- Pricing: `src/services/pricing.ts` is a port of `pricing/price-calculator.html` `compute()`. `src/test/pricing.test.ts` runs the real calculator in a sandbox and compares 300 random quotes plus the 4 spec fixtures; Admin › Price book › Parity check runs the fixtures in the app.
- Rules: BDRs get no extra discount; admins/closers up to 10%; 11–30% needs the other founder's approval; pilots max 2 won per brand.
- Quotes: each save is a new immutable version; unsent drafts are superseded; accepting or paying locks the deal.
- Public: `/q/:token` (quote, accept, pay deposit; `?print=1` opens the print dialog) and `/pay/:id` (fake Stripe test checkout, no card fields). Completing it fires the same `checkout.session.completed` webhook, handled idempotently: payment, Won, client (onboarding), setup commission.
- Migration: `supabase/migrations/20261001000500_m6_quotes.sql`.

## M7 notes
- Billing maths: `src/services/billing.ts` (overage, prorated fees, pilot free month and 12-month pilot rate, annual prepay, health score). Fake voice platform: `src/services/usagePortal.ts`.
- Jobs (`runBillingJobs`, a cron in Supabase mode): daily usage import, month-end usage record + invoice (fake Stripe charges it and sends `invoice.paid`), the monthly report email, automatic onboarding steps, and a call task within 48 h when health drops under 60. Idempotent.
- Go-live (last onboarding step): starts the subscription and bills the setup balance and the first (prorated) month.
- Pause stops billing from the next period; cancel sends a final invoice, creates number-release and data-export tasks and claws back unearned commissions.
- Public report: `/r/:token` (`?print=1` → save as PDF). Reports MRR now drops churned clients.
- Migration: `supabase/migrations/20261001000600_m7_clients.sql`.

## M8 notes
- Lead sources: `src/config/leadSources.ts` (connectors, caps, search plans, CSV templates), `src/services/leadSources.ts` (LeadSource interface, 30-day cache + monthly cost cap, fake connectors), `src/services/websiteAudit.ts` (form, booking, chat, HTTPS, mobile, AI receptionist, 3D/unit picker, PageSpeed, site phone/email → signals).
- List build (`runListBuild`): for each owner's queue shortfall, pages through the search plans for their list type, dedups (provider id, phone, domain, fuzzy name in the same city), skips opt-outs and markets with no allowed channel, audits each website, scores, and stops when enough A/B leads with a usable channel are in. Hitting a cap pauses the job and notifies admins; failures show their error and can be retried; two failures in a row notify admins.
- Screens: Admin › Background jobs (shortfalls, run now, pause/resume, run logs, retry), Admin › Integrations › Places API and registries (connect, caps, spend, cache hits), Admin › Scoring models (rules + monthly conversion by tier and rule), lead detail › Signals › Re-enrich, Today › Run list build (admins), Import › CSV templates (Dubai developers, expo exhibitors).
- Migration: `supabase/migrations/20261001000700_m8_sources.sql`.

## M9 notes
- Tasks: `src/data/taskTypes.ts`, `src/config/tasks.ts` (spaces, statuses, priorities, categories), `src/services/tasks.ts` (grouping, filters, My work buckets, cycle check, mentions, positions, Notion mapping), `src/data/demo/demoTasks.ts`.
- Screens: `/tasks` (list, grouped, inline edits, bulk edit, filters, saved views, keyboard J/K/Enter/X/S/A/T), `/tasks/board` (drag and drop, Shift+←/→, WIP warning, Done this week), `/tasks/my-work`, `/tasks/inbox`, `/tasks/import` (Notion CSV, once), `/tasks/:id` (also a side panel on wide screens).
- Links: tasks link to a lead, deal, client or meeting and show on the lead (Tasks tab, including its deals', meetings' and client's tasks), the deal builder and the client panel. ⌘K finds tasks.
- M7's client follow-ups (health calls, number release, data export) are now tasks in Delivery › Client care.
- Migration: `supabase/migrations/20261001000800_m9_tasks.sql` (moves `client_tasks` into tasks).

## M10 notes
- Capacity: `src/config/capacity.ts` (Appendix 4), availability and time off per person (Workload › Edit hours and time off; split must sum to 100%; people edit only their own).
- Scheduler: `src/services/scheduler.ts` with `src/test/scheduler.test.ts` (dependencies, windows in each person's timezone, focus factor, buffer, review hours for agent tasks, conflicts, MOVE / REASSIGN / SPLIT / SCHEDULE / flag suggestions, determinism). Estimate accuracy (actual ÷ estimate after 4 weeks of time data) replaces the default buffer per person.
- Seeded Q4 launch: Rinor 12 / 12 h in W40 and 14 / 12 h in W41 (coral) with a MOVE suggestion to W42; applying it updates both weeks.
- Timeline: bars (drag to move, edges to resize, arrows on a focused bar), dependency lines (dashed coral when broken), milestones, capacity rows, unscheduled tray (drag to set the due date), day/week/month zoom, optional auto-shift of dependents.
- Migration: `supabase/migrations/20261001000900_m10_capacity.sql`.

## M11 notes
- Planner: `src/services/planner.ts` (Appendix 5 schema, prompt rendering, validation, scheduling of drafts, flags), `src/services/aiProvider.ts` (AIProvider + deterministic fake), `src/data/demo/demoPlanner.ts`. Modes: plan (an idea, or tasks from notes), split (task detail › Split with AI), replan (Workload › Re-plan with AI), weekly (Planner › This week). Validation rejects unknown owners and estimates outside 0.5–40 h; one retry on invalid JSON; every attempt is costed in the plans log; the monthly cap blocks new plans.
- Nothing is written to tasks before Accept. Edits re-run the scheduler, not the AI. Accept creates the tasks (AI label, accepted by, plan id), dependencies, subtasks and a review subtask for Codex work, with dates from the scheduler.
- Fake 3D showcase plan: 9 tasks, 20 team hours, 16 freelancer hours, finishes Thu 29 Oct (before 31 Oct), flags "Rinor is full on 10–11 Oct… moved to 17–18 Oct", the UAE rules check and the freelancer budget.
- Automations: triggers (deal won, task status changed, task created, due date passed), conditions, actions (create tasks from a template, notify, set status/priority, tag). Seeded: deal Won (Gllarix) → onboarding tasks, deal Won (Arcadian) → 3D project tasks, Review → tell the creator, urgent overdue → admins. Actions never trigger other automations.
- Recurring tasks (daily, weekdays, weekly, every 2 weeks, monthly) and goals linked to KPIs (MRR, paying clients, approved meetings this month).
- Migration: `supabase/migrations/20261001001000_m11_planner.sql`.

## M12 notes
- Coaching: `src/config/callRubric.ts` (rubric v1, compliance, retention, forbidden-output guard), `src/services/coach.ts` (TranscriptionProvider + fake, rule-based fake coach with quoted evidence for every score, weighted total with discovery ×2, insights with a 30-call minimum, weekly 1:1 agenda), `src/data/demo/demoCoaching.ts`.
- Jobs (`runCoachingJobs`, run when Team performance opens): transcribe and score new calls over 60 s (only with the legal flag on), weekly sample of 3 calls for the co-founder's human check, 1:1 agendas, retention (recordings 90 days, transcripts and scores anonymised after 12 months). A compliance fail creates a task in Operations › Compliance.
- Seeded: a full week (W39) of 40 BDR conversations plus this week's so far, and 4 short calls that aren't scored.
- Guardrails are tests (`src/test/coaching.test.ts`): no AI output with the flag off; earnings equal the commission rows and don't change with scores; commissions.ts never references coaching; cards in a fixed role order; no emotion/sentiment/tone output; the BDR gets only his own scorecard; viewers get totals; every view is audited.
- Migration: `supabase/migrations/20261001001100_m12_coaching.sql`.

## M13 notes
- Time tracking: `src/config/time.ts`, `src/data/timeTypes.ts`, `src/data/demo/demoTime.ts`, pages in `src/pages/time` (`/time`, `/time/reports`), and the global timer bar `src/components/shell/TimerBar.tsx`.
- Entries link to a task, client, project, lead or deal, with a category and an optional billable flag (clients and projects only). Grid cells round to a quarter hour; a cell sets that day's manual time, and timer entries stay as they are (remove them in the entry list).
- Weeks: draft → submitted → approved. Submitted and approved weeks are locked for everyone (grid, manual entries, timers, deletes) until an admin reopens them with a comment. Another admin approves your week.
- Approving a week turns billable hours into Stripe invoice items (test mode) per client and rate, at the market's custom-software rate (day rate ÷ 8, e.g. $87.50/h in the US). The client's next month-end invoice carries them as "time" lines; reopening withdraws items not yet invoiced.
- Reports: admins see revenue, per hour and margin (cost rates are admin only); the implementer sees hours only; everyone else gets 403. CSV export follows the same rule. Rinor's weekend chart counts only Saturday and Sunday entries in his timezone.
- Estimate accuracy counts finished, estimated tasks with time logged on them. The scheduler and the planner use each person's ratio as their buffer (now on the same basis).
- Seeded: September 2026 matches the mockup (345 h: Rinor 49, co-founder 128, BDR 168; client work 34.5 h; Prishtina €148/h, Sunrise $80/h, Bluewater $120/h; weekends 11/12/14/12; accuracy 1.3/1.1/1.0/1.4). W36–W39 are approved.
- No idle, activity, screen or app tracking anywhere; a test checks the time code for it. A timer running over 10 hours asks on the next page load whether to keep it or set when you stopped.
- Migration: `supabase/migrations/20261001001200_m13_time.sql`.

## M14 notes
- AI co-founder: `src/services/advisor.ts` (tool access per role, figure-source check, cost estimate, the deterministic fake provider), `src/data/demo/demoAdvisor.ts` (the 19 tools from the runtime prompt, threads, drafts, Accept, memory, jobs, finance data), `src/pages/advisor` (`/advisor`, `/advisor/:threadId`), Admin › AI co-founder and finance.
- Tools run as the asking user: they call Atlas's own API, so every access rule applies. Finance tools (cash, expenses, MRR history, scenarios) are for admins and the viewer; team performance for admins; finance files are left out of knowledge search for other roles. A BDR asking about cash gets "That information isn't available for your role."
- Read-only tools are guarded: if one changes any record, the change is undone and the call fails. Only `propose_tasks`, `propose_decision` and `draft_document` write, and only drafts. Accept (a person) creates the tasks (Company › AI co-founder), the proposed decision, or the saved document.
- Every figure in an answer must appear in a tool result, a cited file, a labelled assumption or the question; anything else is listed as "unsourced" under the answer.
- Scenarios: `src/services/scenarios.ts` ports `models/scenarios_by_brand.py` (revenue by brand) and `models/scenarios_combined_v2.py` (stage costs and cash) with Python-exact rounding; `run_scenario` merges them and adds hires and opening cash. Parity: `python scripts/scenario_parity.py` writes `src/test/fixtures/scenario_parity.json` (the models' own scenarios + 30 random variants each); the test fails if the model files change without regenerating.
- Knowledge: `knowledgePlugin.ts` serves `spec/context`, `spec/backbone`, `spec/plans` and two READMEs to dev and tests as `virtual:atlas-knowledge`. Production builds get an empty list (the repo is public), and `spec/prompts` is never included. BM25 over heading-sized passages (`src/services/knowledge.ts`); `backbone/08` is excluded because it holds the evaluation answers. Supabase mode: `knowledge_docs` with Postgres full-text search, synced on deploy.
- Evaluation: `src/config/advisorEval.ts`, the 20 questions from backbone/08 with expected tools, files and conclusions; all pass against the fake provider (`src/test/advisor.test.ts`).
- Jobs (run when an admin opens the page; pg_cron in Supabase mode): Monday briefing after Mon 07:00 CET (KPIs, gates, cash vs reserve, risks, 3 tasks due this week), month-end close for last month (revenue, costs by category, MRR, per-hour by client, variance vs the realistic scenario, questions for the accountant), alerts (cash below reserve, gate passed, churn risk, AI cap hit, tasks over a week late). Each creates a team thread and notifies the admins, once.
- Seeded: the 6 decisions from the context/07 decision log, September expenses (tools, data, usage, BDR base, fees, the 3D freelancer), a €3,420 cash snapshot on 30 Sep, and "Cash reserve target €3,000" as an approved memory fact.
- Migration: `supabase/migrations/20261001001300_m14_advisor.sql`.

## M2 notes (completed after M14)
- Tests per rule (`src/test/m2.test.ts`): every scoring rule in both models gets a passing and a failing case derived from its own condition, plus expiry on both sides of `expires_days`; every country rule is checked for calls, email, calling window and cold SMS, plus the UK TPS note, the Swiss directory asterisk and the US autodialer rule. Coverage tests fail if a new rule, field or country-rule key has no case.
- Compliance additions (`services/compliance.ts`): cold texts (blocked unless a market sets `smsCold`), `call_block` number flags (Swiss directory asterisk; two seeded Swiss numbers carry it), `autodialer_to_mobile` (blocked for autodialed calls to US mobiles; Atlas dials by hand), and erased leads can't be contacted.
- `score_history`: the first score and every change of score or tier, with the previous values and why (initial, change, nightly, rescore). Lead detail shows the last five. In Supabase mode a trigger writes it, whoever updates the lead.
- Nightly job (once a day after 02:00 UTC; demo: while Atlas is open; Supabase: pg_cron): rescores active leads so expired signals drop out, then retention. Admin › Country rules lists the runs.
- Retention (A10): personal data of lost leads (from their last touch) and never-worked leads (from creation) is erased after 12 months, editable in Admin › Country rules. Stats stay.
- GDPR: admins export a lead's personal data as JSON and erase it (names, emails, phones, notes, email bodies). Erased identifiers go on the opt-out list (reason "erasure") so imports never bring them back.
- Admin › Country rules: every market's rules, a warning while any market is unconfirmed by counsel, retention and the nightly runs. Admin › Scoring models already showed the rules (M8).
- Migration: `supabase/migrations/20261001001400_m2_compliance.sql` (checked on Postgres: trigger, retention query and erase function).

## Theme and QA pass (2026-10-01)
- Colors: layered tokens in `src/styles/tokens.css`: chrome (sidebar, top bar) → page → card → raised, with inputs inset; stronger lines; tinted fills for status (tier, stage, brand and status chips); table header rows on the raised layer. The sidebar is grouped: Sell, Deliver, Insight, Manage.
- Light mode: the same tokens under `html[data-theme="light"]`. Toggle in the top bar (sun/moon) and System / Light / Dark in the user menu; it follows the system until a person picks one (`src/lib/theme.ts`; `index.html` sets it before the first paint). Mobile-only pages (Today, Team, AI co-founder on a phone) follow the system setting.
- Tailwind colors now go through `color-mix(... <alpha-value>)`, so opacity modifiers work on token colors. Before, `bg-bg-deep/80` and similar generated nothing: modal, drawer and command-palette backdrops were missing.
- QA sweep: `npm run test:qa` renders every route for admin, BDR, implementer and viewer and fails on crashes, console errors, stuck loading, leaked "NaN/undefined" or a wrong 403 (118 role × route checks). It runs separately from `npm test` because it is CPU-heavy; `npm run test:all` runs both.
- Fixed in the QA pass:
  - Lead detail: Book meeting was disabled (opens the booking dialog now and returns to the lead); the Deals tab always said 0; the suggested-offer card showed a placeholder (now price-book list and pilot prices for the lead's market, with Create quote).
  - Call workspace: the offer card showed a placeholder (now real prices); meetings booked from a call sent no confirmation or reminders (now the same as the booking page).
  - Leads › Add to cadence was disabled (now a bulk action; owners for their own leads; closed, opted-out or erased leads are skipped). Lead import gets a cadence choice (default, another cadence, or none).
  - The queue gave leads with no cadence the list's default cadence anyway.
  - Import planning took 5–7 s for 2,000 similar names (now ~0.3 s, same results: an exact upper bound skips pairs that can't reach the threshold; property-tested).
  - A flaky coaching test (random sample could push the human score past 100).
  - Leftover "arrives in M3/M5/M6" copy in Pipeline, Reports and Import.
  - The knowledge plugin now watches the spec files, so edits reach the AI co-founder without a dev-server restart.
- Known: the two speed checks in `leads.test.ts` (import planning, 20,000-lead filter) can miss their limits when the whole suite runs in parallel on a busy machine; they pass on their own.

## Colors, calendar, alerts, ClickUp/Zoho layouts (2026-10-01)
- Light mode is a soft slate scheme now (no white surfaces): chrome #CDD5DF, page #D8DEE6, cards #E4E8EE, dark slate text.
- More hues (blue, teal, orange, pink, lime) and one color per category in `src/config/colors.ts`: deal and lead stages, task statuses, priorities, meeting types, categories, brands, and a stable color per person (avatars). Shared `Pill`, `Dot` and `Avatar` primitives.
- Pipeline (Zoho-style): 216 px columns with the stage color on the top bar, header, count and totals; compact cards with brand stripe, amount, brand/pilot tags, owner avatar, next meeting (blue) or age (amber when stale).
- Leads: 40 px rows, zebra and hover, colored stage pills, owner avatars, next action in coral (overdue) or blue (today).
- Meetings: Calendar (default) and List views. Google-Calendar-style week (hour grid, all-day row for tasks, now line, overlapping events side by side) and month views of meetings (color by type), callbacks, tasks due and the person's Google busy time. Admins can open anyone's calendar.
- Google Calendar per person: connect from Meetings, the user menu (Calendar and alerts) or the prompt after sign-in. Atlas pushes the person's meetings and callbacks, keeps them in sync (moves, removals) and shows their own Google events as busy. Demo mode uses a test connection; Supabase mode uses Google OAuth in the "google-calendar" Edge Function (tokens server-side only).
- Email alerts to the person responsible: meeting booked for you, meeting in 1 hour, callback in 15 minutes, urgent task assigned, high/urgent task overdue (daily). Once each; each person can switch each type off. Demo mode keeps them in Atlas (Calendar and alerts → Last alerts).
- Tasks (ClickUp-style): filled status group pills, colored status boxes, stacked assignee avatars, priority flags, colored category tags, due dates red (overdue) / orange (today), 36 px rows; board columns tinted by status with filled header pills and compact cards (title, tag, progress, flag, due, subtasks, estimate, avatars).
- Leads list is faster: the default sort formatted local time inside the comparator; now once per timezone.
- Migration: `supabase/migrations/20261001001500_calendar_alerts.sql` (connections with server-only tokens, event links, busy time, preferences, alert emails).
- Meetings: "+ New meeting" (and clicking an empty calendar slot) books a meeting for a lead without logging a call: `createMeeting` sets the stage, opens the deal, queues the confirmation and reminders, and syncs to the owner's calendar. The week view has all 24 hours in its own scroll area, opening at 07:00.
- Pipeline and Tasks › Board fill the window: each stage/column scrolls on its own; colors only on the top bar and header; no borders on columns or cards; no brand stripe on cards. The Tasks spaces sidebar scrolls on its own.
- Dialogs scroll on short screens, so their buttons stay reachable.
