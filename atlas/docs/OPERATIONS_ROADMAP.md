# Running the company inside Atlas: what's missing

Written 2026-10-02 after a full UX pass. Today Atlas is a complete **demo**: every screen works, but with fake data in each browser, a fake mailbox, fake telephony, fake Stripe and a test-mode Google connection. The list below is what it takes to run day-to-day operations in it, most important first.

## P0: make it real (without these nobody can use it for actual work)

1. **Connect the app to Supabase.** Sign-in works against Supabase; about 209 data functions still return "not wired yet". Wire them module by module, in the order the team uses them: leads and the call queue, meetings and pipeline, tasks, deals, clients, time, then reports. Row-level security per role (admin, BDR, implementer, viewer) is already in the migrations; it needs tests against a real project.
2. **Real accounts.** Invite by email, magic link, password reset, deactivate a user and hand their leads over, and two-factor sign-in for admins.
3. **Real email.** Send from our own domains (Gllarix and Arcadian) through a provider such as Postmark or Resend, with SPF/DKIM set up. Detect replies so cadences stop on their own. Show each email thread on the lead and the client. Alert emails (meetings, callbacks, urgent tasks) go through the same sender.
4. **Real calling.** Twilio in the call workspace: click to call, a caller-ID pool per country, recordings, and automatic call logging with duration. Keep the country calling rules that are already enforced.
5. **Real Google Calendar.** OAuth per person (tokens server-side only), two-way sync, plus a public booking link that prospects can use to pick a slot.
6. **Real Stripe.** Quote → checkout → subscription, with invoices and usage charges from the client usage data. Use a signed webhook in an Edge Function. Use test keys first, then go live.
7. **Safety net.** Daily backups, error tracking (for example Sentry), an uptime check, and a written restore procedure. The audit log already exists.

## P1: so most operations happen in Atlas instead of Notion, Gmail and sheets

8. **Company and contact records.** A proper company page with several contacts, roles, notes and files, plus a merge screen for duplicates. The duplicate detection itself already exists.
9. **Documents and e-signature.** Proposal and contract templates filled in from the deal, sent for signature, with the signed PDF stored on the client. Each client gets a file storage area.
10. **Client operations.** An onboarding checklist that creates the right tasks automatically, support tickets (the health score needs them), and a monthly client report sent from Atlas.
11. **Finance.** Invoices list, expenses, cash and runway (the AI co-founder already reasons about these), commission and bonus statements for BDRs, and an export to the accountant's tool (Bexio, Xero or QuickBooks).
12. **Team and hiring.** Onboarding a new BDR (training tasks, scripts, ramp-up targets), time-off, and contractor payouts from approved timesheets.
13. **Scripts and playbooks inside Atlas.** Call scripts, objection answers and email templates are drafts today. Admins should be able to edit and version them, and see which version wins more meetings.
14. **Notifications where people already are.** Slack (or WhatsApp) alerts for meetings booked, deals won and overdue tasks, with per-person settings. In-app and email notifications already exist.
15. **Moving off Notion for good.** The Notion task import exists; add a one-time import for docs and wiki pages, then make Notion read-only.

## P2: UX improvements found in the review (not done yet)

16. **Search everything.** Ctrl K finds pages, leads and tasks; add deals, clients and meetings.
17. **One table component.** Leads, Deals, Tasks and Time each have their own table. Use one shared table with sortable columns, column picker, saved views and "+ Filter on any field" (the Tasks list already has saved views).
18. **Lead page gaps.** Add or edit contacts, tags and files on the lead itself.
19. **Meeting detail page.** Notes, attendees, the recording, the outcome and the follow-up tasks, in one place.
20. **Useful empty states.** Every empty screen should say what to do next and offer the button for it. Add a first-day checklist for a new user.
21. **Keyboard help.** Press `?` to see all shortcuts. There are many shortcuts and they're hard to discover.
22. **Phone and tablet.** Only some pages work on small screens. At minimum: Today, Meetings, Tasks and the task page.
23. **Accessibility check.** Contrast of muted text in light mode, visible focus everywhere, and screen-reader labels on icon-only buttons.

## Platform structure and design system (2026-10-02, second pass)

- **One platform with apps.** The sidebar starts with an app switcher: Sell, Work, Money, People, Growth and AI. Each app has its own pages and accent colour. Planned parts appear dimmed with a "Soon" tag:
  - Inbound;
  - Operations plan;
  - Payments, ROI and investment, Financial plan;
  - Hiring, Training, KPIs per role;
  - Marketing, Market and competitors;
  - AI BDR calling agent, AI performance tracker.

  Admin is now "Settings" at the bottom of the sidebar.
- **New pages:**
  - **Money › Finance:** cash, monthly costs, runway, expenses by category and cash snapshots. These moved out of Admin › AI co-founder.
  - **Money › Prices and calculator:** the price book.
  - **People › Bonuses and commissions:** pending, earned, paid and clawed back. Everyone sees their own lines; admins see everyone's.
- **Design system:**
  - Raycast-style dark base with the Arcadian/Gllarix ice blue;
  - Inter type;
  - sentence-case labels instead of tracked uppercase;
  - glossy cards and keycaps.

  See `spec/design/README.md`.
- **Deals and quotes rebuilt:**
  - **List:** summary tiles; search and filters; deals grouped by stage; what the client pays; quote progress bars; a plain-language next step.
  - **Deal page:**
    - a stage selector;
    - one main action that follows the quote (Save → Send → Resend);
    - a five-step progress bar;
    - numbered Market / Package / Options sections, with the price book inline;
    - one "What the client pays" panel with the price breakdown on demand;
    - a separate "Internal only" panel (commission, effort, margin, discount approvals);
    - Quote history, Tasks and Payments tabs.

## Money › Payments and Money › Financial plan (2026-10-02)

**Payments** (admins only):
- **Tiles:** cash collected this month, MRR, open invoices and late invoices.
- **Chart:** collected per month for the last 6 months, in EUR at the planning rate, with a breakdown by type on hover.
- **Open invoices:** each shows where it is on the failed-payment ladder from `spec/backbone/09` (Stripe retries → day 3 email → day 7 call → day 14 pause → day 30 cancel) and what to do now.
- **All payments:** filterable by type.
- **New data call:** `listInvoices()` returns invoices across all clients.

**Financial plan** (admins only):
- The 12-month scenario model (`services/scenarios.ts`, a port of `spec/models`).
- **What-if controls:**
  - scenario;
  - sales pace;
  - Gllarix monthly fee;
  - churn;
  - starting from cash on hand;
  - hiring setter #1 from a chosen month.
- **Tiles:** 12-month revenue, MRR against the €10k June target, lowest cash against the €3,000 reserve, and actual vs plan.
- **Charts:**
  - MRR plan vs actual;
  - revenue by brand;
  - cash at the end of each month, with the reserve line.
- **"When the gates open":** the month each stage gate is met.
- **Month-by-month table.**

From €0, the realistic low point (−€737 in Oct 26) matches the spec's "about −€740", and a test checks it.

Still to do: Payments and the plan read demo data until Supabase and Stripe are connected (P0 items 1 and 6).

## Money › ROI and investment (2026-10-02)

This page follows `spec/backbone/09` and `03`. It is admins only.
- **Unit economics:** plan vs actual for contribution per client, CAC, LTV, LTV ÷ CAC, payback and break-even. Actuals come from live clients, won deals and logged expenses.
- **What to fund next:** the 9-step investment order. Each trigger is checked against live data: the gates from Reports, cash against the €3,000 reserve plus two months of setter pay, and MRR. Gates that must hold for several months explain what is still needed.
- **Should we spend on this?:** the ROI test.
  - Payback window by spend type: tool 3 months, hire 6, marketing 6 weeks, build 12.
  - Inputs: monthly and one-off cost, and the expected gain (approved meetings, new clients or gross profit).
  - Assumptions: 20% close rate, €610/month contribution, and 60% of the setup fee counted as profit.
  - Output: a verdict, ROI, payback month and a cumulative cost-vs-gain chart.
  - "Log spend" writes a proposed line to the decision log with cost, expected gain, stop rule and review date, and notifies the other founder.
- **Split money in:** founder money split 30/25/15/10/20 and setup fees split 40/30/20/10.

With this, every Money page is built.

## People › Hiring and Training (2026-10-02)

Both pages follow `spec/backbone/05`.

**Hiring** (founders only):
- **Openings:** each role has a status (hiring, draft, waiting for its gate, filled), its gate, pay, what it owns and the job post. The seed has the BDR backup, the list builder, setter #1 and the implementer.
- **Pipeline:** the SOP 8 steps as columns (applied, screen, paid roleplay, paid trial week, offer, hired). Candidates can't skip a step.
- **Candidate panel:**
  - the weighted scorecard (6 criteria scored 1–5, giving a score out of 100; 70+ with no red flags counts as strong);
  - red flags;
  - voice-note link and notes;
  - bench and "not a fit".
- **Hiring a candidate:** marks them hired, fills the opening and starts their training.

**Training** (founders edit; BDRs and closers see their own program):
- **The 10-day program:** 6 blocks, each with a gate, passed in order and checked against evidence:
  - 5 roleplays scored 7/10 or more;
  - a compliance quiz scored 8/10 or more;
  - the first approved meeting, found automatically in Atlas;
  - 3 closing roleplays;
  - certification to close alone.
- **Day count:** the program day is counted on working days.
- **Side panels:** a "ready before day 1" asset checklist and the weekly rhythm after training.

The data is new tables (`openings`, `candidates`, `trainees`), created on first use so existing demo data keeps working. In Supabase mode they still need a migration.

## People › KPIs per role (2026-10-02)

This page is founders only and covers every role in `spec/backbone/05`: BDR, setter, closer, implementer, co-founder and Rinor.
- **Each role shows:** the KPI, its target, this week's (or last week's) value, its status, and how it is measured.
- **Where the numbers come from:**
  - BDR and co-founder: the weekly report per person, plus today's queue;
  - implementer: deposit-to-go-live days and first-month churn, from payments, deal won dates and clients;
  - Rinor: the share of setups delivered within 7 days.
- **Not measured yet:** setup hours, month-end close and PR reviews (GitHub). The page says what each one needs instead of showing a number.
- **Diagnostic rule:** on the BDR's week, activity on target with no meetings means the script or the list is the problem; activity off target means the rep.
- **Empty roles** (setter, closer) show when to hire, with a link to Hiring.

With this, the People app has no "Soon" pages left.

## Growth › Marketing and Market and competitors (2026-10-02)

Both pages follow `spec/backbone/10` and `11`. Founders edit; BDRs, closers and the viewer can read.

**Marketing:**
- **Tiles:** meetings booked this week, approved meetings, inbound leads this month, the share of meetings from referrals and inbound, and cost per approved meeting.
- **Positioning:** both brands, with the "words we don't use".
- **Copy check:** flags banned phrases and claims that need client data (percentages, time saved, comparisons, guarantees, "first/best").
- **Inbound channels:** the 10 channels with owner, due date, KPI and status.
- **Tests:** each has a budget and a stop rule; spending over budget is blocked. The seed is the €200 Google Search test, planned and not started.
- **Outbound lists and messaging kit:** the two outbound lists, plus the messaging kit with copy buttons and the top objections.

**Market and competitors:**
- **Markets:** the 9 target markets by priority, with live leads, meetings in the last 30 days, open deals and won deals, plus the cold call and cold email rules taken from the country rules Atlas enforces.
- **Competitor map:** for both brands, against our price, with the date each price was last checked (flagged after 90 days). "Checked today" covers the quarterly manual check.
- **Account rules:** listed at the bottom of the page.

The data is new tables (`marketing_channels`, `experiments`, `competitors`), created on first use. Supabase mode needs a migration.

Every app is now built; the only "Soon" items left are Inbound (Sell), Operations plan (Work) and the two AI agents.

## Sell › Inbound and Work › Operations plan (2026-10-02)

**Inbound** (founders, BDRs and closers):
- **One inbox** for website forms, demo-line calls, referrals, the Google profile, chat and booking-page bookings. Booking-page bookings arrive already answered, because the meeting is the answer.
- **Speed-to-lead clock:** proposed target 15 minutes (`INBOUND_RESPONSE_TARGET_MIN`).
- **Tiles:** requests waiting, share answered within the target, median first reply, and how many became leads.
- **Actions:** take it, mark replied (stops the clock), make it a lead, not a fit, spam.
- **Making a lead** uses the same matching as the booking page (email → domain → phone): no duplicates, the source is recorded, and the message goes into the lead's timeline.
- **Test request:** admins have a test button until the website forms and the demo line post to Atlas through an Edge Function.

**Operations plan** (everyone internal; founders edit the SOPs):
- **Operating rhythm:** a live checklist for today, this week, this month and this quarter. Ticks are kept per period; weekly items turn amber once their day has passed; automatic items show as done.
- **SOPs:** the 10 SOPs with owner, due date and status. An SOP can only be marked written once its link is added. The page tracks whether SOPs 1–4 are done before 26 Oct.
- **Delivery capacity:** setups waiting and deposit-to-go-live days, plus the implementer trigger (more than 2 setups queued, or one waiting over 7 days).
- **Reference tables:** service levels, who does what, compliance (with links to where Atlas enforces each rule), vendors and the risk register.

**Data:** new tables (`inbound_requests`, `sops`, `ops_checks`), created on first use. Supabase mode needs a migration plus the inbound Edge Function.

Only the two AI agents (BDR calling agent, performance tracker) are still "Soon".

## Done in the first pass (2026-10-02)

- **One visual language.** Rounded corners on cards, buttons, inputs and panels across the app (Tasks already used them). People's avatars are round. Every status, stage, brand and KPI badge is now the same rounded colored pill instead of three different styles.
- **Calendar banner.** The Google Calendar banner was on every page. It's now one line on Today only, with "Not now" to hide it for good (it stays available in the user menu).
- **Today numbers.** The admin's Today page showed "Meetings booked 0" next to team rows with 7 booked. In the team view the cards now add up the whole team.
- **Deals table.** Colored stage pills, owner avatars and plain-case column headers.
- **Leads table.** The owner column shows first names (full name on hover) instead of cut-off text.
- **Pipeline.** Rounded columns and cards.
- **Tests.** The QA sweep now uses the demo password from `.env.local`, as the app does, instead of a hard-coded one.

## Company operations and interface polish (2026-10-02, all in demo mode)

**Moved into Atlas**
- **Contracts and e-signature (P1 item 9):** Deal › Contract fills the agreement from the latest quote, sends a signing link (/c/:token), and files the signed PDF with an audit trail on the deal and the client. Before the first real signature: a lawyer reviews the two templates in `config/contracts.ts`, and the legal entity, address and governing law placeholders get filled in.
- **Support tickets (P1 item 10):** Work › Support and a Support section on each client. Service levels come from the operations plan. Open tickets lower the client's health score, and overdue ones appear in "Needs a founder".
- **Monthly client report (P1 item 10):** already sent from Atlas at month end (and by hand from the client page), with a public link.
- **Off Notion (P1 item 15):** Work › Docs and wiki, with a Notion import and a four-step checklist. The last step, making Notion read-only, is done in Notion by a founder and ticked in Atlas.

**Interface (P2 items 16–23)**
- **Ctrl K:** also finds deals, clients, meetings and docs.
- **One table:** `components/DataTable.tsx`, used by Leads, Deals, Tasks and Time reports.
- **Lead page:** contacts, tags and files.
- **Meeting page:** /meetings/:id.
- **Phones:** bottom tab bar, and Meetings, Tasks, Inbound, Support and Docs marked phone-ready.
- **Accessibility:**
  - muted text meets 4.5:1 in both themes;
  - table rows show a focus outline;
  - "Skip to content" link;
  - checked live: every field and icon-only button on the main pages has an accessible name.
- **AI app:** the AI BDR agent (shadow mode until Twilio and an AI voice are connected) and the performance tracker replace the two "Soon" items.
