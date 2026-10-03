# Screens status

| Screen | Spec | Status | Gaps |
|---|---|---|---|
| Shared layout: sidebar, top bar | 00_SHARED_LAYOUT | Done | Running-timer strip on every page (M13) |
| Sign in | 01 | Done (demo) | Magic link and invite flow need Supabase (Q1) |
| Command palette | 13 | Done (demo) | Searches leads, deals, clients, meetings, docs, tasks, pages and actions, each with the same access as its page |
| Notifications panel | 13 | Done (demo) | Real events arrive with M4; email delivery preference later |
| Style guide | 14 | Done | |
| Admin shell | 12 | Partial | Users and roles (read-only), Settings (branding editable), Cadences (templates), Opt-out list, Integrations (email) and Audit log work; country rules, scoring, price book and jobs ship with their milestones |
| Admin › Opt-out list | admin/07 | Done (demo) | CSV import of opt-outs; second-admin approval for removing complaint/legal entries (blocked for now) |
| Today | 02 | Done (demo) | "Today's priorities" for admins shows the team view until Tasks (M9) |
| Call workspace | 03 | Done (demo, fake telephony) | Real Twilio calling and caller-ID pool; offer prices (M6); email and demo line (M5); "lead being worked by someone else" warning; script and objection answers are drafts until the co-founder writes them |
| Leads list | 04 | Done (demo) | "+ Filter" for any field, saved filters per user, add-to-cadence (M3); offset paging instead of cursor (fine in demo, cursor in Supabase mode) |
| Lead detail | 05 | Done (demo) | Add and edit contacts (a changed email or phone goes back to not verified), tags in the header (also shown on the Leads list), files up to 2 MB each in the browser until Supabase Storage |
| Import leads | 06 | Done (demo) | Runs in the browser rather than as a background job; mapping templates per source not saved yet; cadence on import (M3) |
| Pipeline board | 07 | Done (demo) | Market and created-date filters; cards open the deal builder |
| Meetings and approval | 08 | Done (demo) | Meeting page /meetings/:id: prep and notes (saved as you type), attendees, recording, outcome and approval, next steps and linked tasks, the lead's history. Phones open on a list of meeting cards. Still open: reopening a closed month |
| Reports | 11 | Done (demo) | Drill-down from bars and KPIs; 15-minute cached job; editable targets in Admin › Settings; churn for gate 3 (M7) |
| Deal and quote | 09 | Done (demo, fake Stripe). Rebuilt 2026-10-02: grouped list with next steps; deal page with stage selector, progress steps, numbered sections, client-facing totals separate from internal numbers | Real Stripe test keys (Edge Function + signed webhook); real PDF (print-to-PDF for now); quote opened/viewed notifications by email |
| Clients and usage | 10 | Done (demo, fake voice platform + fake Stripe) | Support tickets and files on each client; open tickets now count in the health score. Real UsagePortal and Stripe in Edge Functions still to do |
| Tasks list, board, detail | 15–17 | Done (demo) | Split with AI and the planner note (M11); recurring tasks; swimlanes; GitHub PR card. 2026-10-01 layout change: the spaces sidebar is now a tab row (My work, Inbox, spaces), with the space's lists as chips; there's one icon view row with the filters and New task; the board and task page use the Notion style (rounded tinted columns, emoji + bold title, property row, View details, comments above the description). The main sidebar can collapse (remembered in `atlas-sidebar-collapsed`). |
| Timeline and workload | 18–19 | Done (demo) | Swimlanes; AI re-plan suggestions (M11) |
| AI planner | 20 | Done (demo, fake AI provider) | Real Anthropic provider in the "planner" Edge Function |
| Team performance, scorecard, call review | 21–23 | Done (demo, fake transcription + coach) | Real transcription and coach Edge Functions; real audio player with signed URLs; GitHub stats for the Codex agent |
| Sell › Inbound | backbone 10 | Done (demo) | One inbox (forms, demo line, referrals, booking page), speed-to-lead clock (15 min proposed), claim/reply/convert/dismiss with lead matching. Needs the inbound Edge Function + migration |
| Work › Operations plan | backbone 04 | Done (demo) | Rhythm checklist per period, SOP tracker (done needs a link), delivery capacity + implementer trigger, service levels, compliance, vendors, risks. Needs a migration (sops, ops_checks) |
| Growth › Marketing | backbone 10 | Done (demo) | KPIs, positioning, copy claim check, inbound channels, tests with budget + stop rule, outbound lists, messaging kit. Needs a Supabase migration (marketing_channels, experiments) |
| Growth › Market and competitors | backbone 11 | Done (demo) | 9 markets with live numbers and channel rules, competitor map vs our price with quarterly check, account rules. Needs a Supabase migration (competitors) |
| People › KPIs per role | backbone 05 | Done (demo) | All six roles with targets, live values and the diagnostic rule. Not measured yet: setup hours, month-end close, PR reviews (GitHub) |
| Work › Support | backbone 12 | Done (demo) | Tickets with service levels (first reply and fix time from the operations plan, urgent gets half), reply or internal note, owner, priority. Overdue tickets show in "Needs a founder". Needs the support migration and an inbound address per client |
| Deal › Contract and e-signature (/c/:token) | backbone 09 | Done (demo) | Filled from the latest quote, editable draft, signing link, typed-name signature with "I agree", signed PDF with an audit trail and SHA-256 of the text, stored on the deal and shown on the client. The template wording is a draft: a lawyer reviews it, and the legal entity and governing law are placeholders |
| Work › Docs and wiki | — | Done (demo) | Nested pages in Markdown, tree, search, backlinks, subpages; Notion import from the unzipped Markdown & CSV export (re-import updates); "Moving off Notion" checklist. Images stay in Notion for now |
| AI › AI BDR agent | — | Done (demo, shadow mode only) | Calls back inbound requests only (consent), inside local hours, with an AI disclosure; shadow runs show who it would call. Live needs Twilio + an AI voice, prompt server-side |
| AI › Performance tracker | — | Done (demo) | Each seller's week vs targets and last week, one focus from the first leak in the funnel; founders see everyone, a BDR sees their own; never sets pay |
| Shared table | — | Done | Leads, Deals, Tasks and Time reports use one DataTable: sortable headers, column picker (remembered), folding groups, selection, rows that open with click or Enter |
| Phone | — | Done | Bottom tab bar and top bar on phones; Today, Meetings, Tasks and the task page, Inbound, Support, Docs, Team, AI co-founder and the tracker work at 375 px |
