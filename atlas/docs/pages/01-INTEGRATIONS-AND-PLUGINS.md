# Integrations, imports and plugins

Goal: connect Atlas to everything we already use, and stop paying for tools whose job Atlas can do. One framework handles all of it, so adding a connector is a small, repeatable job instead of a new project each time.

---

## 1. The architecture (one bus, three kinds of connector)

```
            ┌──────────── Atlas core (Supabase: Postgres + RLS) ────────────┐
 inbound ─▶ │  Webhook inbox (Edge Function, signed, idempotent)             │
            │        │                                                       │
            │        ▼                                                       │
            │  events table  ── lead.created, deal.stage_changed,            │ ─▶ outbound webhooks
            │        │          invoice.paid, ticket.created, …             │ ─▶ Slack / WhatsApp alerts
            │        ├──▶ Automations engine (rules: when → if → then)       │ ─▶ email (Resend/Postmark)
            │        ├──▶ Notifications (in-app, email, push)                │ ─▶ AI co-founder memory
            │        └──▶ Connector sync jobs (pg_cron + Edge Functions)     │
            └────────────────────────────────────────────────────────────────┘
```

- **Events table:** every write emits an event row (`type`, `entity`, `entity_id`, `actor`, `payload`, `at`). It's the single source for automations, alerts, webhooks and the audit log.
- **Connector record:** stored in Settings › Integrations, with these fields:
  - `provider`, `status` (not connected / connected / error);
  - `scopes`;
  - `last_sync_at`, `last_error`;
  - `settings` (JSON);
  - secrets in Supabase Vault, never in the browser.
- **Connector types:**
  1. **Native** (built and maintained by us): Google Calendar, Gmail/Workspace, Twilio, Stripe, Resend, Slack, WhatsApp, Notion import, Wise, bank CSV.
  2. **Generic** (no code per tool):
     - inbound webhooks with a URL per source and field mapping;
     - outbound webhooks per event type;
     - CSV/XLSX import with saved mappings;
     - scheduled HTTP pulls.
  3. **Plugins** (later): a manifest that adds a tab to a record page, an action to Ctrl K, an automation step or a metric tile. They run sandboxed in an iframe and talk to Atlas through a narrow API, with per-plugin scopes.

## 2. Native connectors, in order of value

| # | Connector | What it does in Atlas | Replaces | Needs |
|---|---|---|---|---|
| 1 | **Twilio voice** | Click-to-call from the call workspace, recordings, caller ID per country, call logging, AI agent voice | Aircall / Close dialer (~$40–90/seat/mo) | Twilio account, numbers, Edge Function for tokens |
| 2 | **Stripe** | Deposits from quotes, subscriptions, usage charges, invoices, failed-payment ladder | Invoicing tools | Keys in Vault, signed webhook |
| 3 | **Email (Resend or Postmark) + Gmail read** | Send cadences and alerts from our domains, catch replies, show threads on records | Lemlist / Apollo sequences (~$60–100/mo) | DNS (SPF, DKIM, DMARC), inbound parse webhook |
| 4 | **Google Calendar** | Two-way sync, free/busy on the booking page, meeting links | Calendly (~$12–16/seat) | OAuth per person, tokens server-side |
| 5 | **Slack or WhatsApp** | Alerts: inbound waiting, meeting booked, deal won, ticket overdue; slash command "/atlas lead acme" | — | App install, per-person settings |
| 6 | **Bank / Wise CSV + statement import** | Expenses and cash snapshots without typing | Bookkeeping data entry | Mapping templates |
| 7 | **Accountant export** | Month-end CSV/XLSX in the format Bexio, Xero or QuickBooks import | Manual reconciliation | Chosen tool's format |
| 8 | **Lead sources** | Google Places, Companies House, Zefix, planning portals, CSV, website form, demo line | Apollo / ZoomInfo data (partly) | API keys, rate limits |
| 9 | **Notion** | One-time import of tasks (done) and docs (done) | Notion (~$10/seat) | Export file |
| 10 | **Voice platform (client receptionists)** | Usage minutes, calls, bookings per client → billing + reports + health | Spreadsheets | Platform API |
| 11 | **GitHub** | PR stats for the Codex agent, issues ↔ tasks | — | App token |
| 12 | **AI provider (Claude)** | Co-founder, planner, call coach, BDR agent, tracker | — | Server-side prompts and keys only |

## 3. Generic connectors (cover everything else without code)

**Inbound webhook**
- Settings › Integrations › "+ Inbound webhook" gives a secret URL.
- Map the JSON fields to an entity, e.g. a website form → inbound request, or Typeform → lead.
- Every call is logged, with a replay button.

**Outbound webhook**
- Pick events (e.g. `deal.won`) and a URL. Requests are signed with HMAC.
- Retries with backoff. A delivery log shows each response.
- This is how Zapier/Make or our own scripts plug in without us building every integration.

**Import Center** (Settings › Import)
- One wizard for every entity: upload → map columns (saved per source) → preview with duplicate detection → import → undo the whole batch.
- Formats: CSV, XLSX and JSON. Ready-made mappings for HubSpot, Pipedrive, Notion and Apollo exports.

**Export Center**
- Any table view can be exported as CSV or XLSX.
- Scheduled exports, e.g. the month-end pack for the accountant on the 1st.
- Every export is in the audit log.

**API keys**
- For our own scripts, scoped per entity with read/write.

## 4. Automations engine (shared by every app)
- **Rule shape:** WHEN (event or schedule) → IF (conditions on the record) → THEN (actions).
- **Actions:**
  - create task, notify, send email/SMS, set field, move stage;
  - add to cadence, create ticket, call webhook;
  - ask the AI (summarise, classify, draft) and wait for approval.
- **Safety:**
  - every rule has a dry run ("would have fired 12 times last week");
  - a run log;
  - an on/off switch;
  - a rate limit;
  - nothing sends to a client without passing compliance (country rules, hours, opt-out).
- **Templates:** a starter library per app, e.g. "deal won → onboarding tasks", "invoice 3 days late → reminder", "inbound not answered in 15 min → alert founders", "ticket overdue → Slack".
- **Value:** the "Runs by itself" ledger on Automations already prices the hours each rule saves. Every new rule appears there automatically.

## 5. Build or buy, applied
- **Build** what makes us win or replaces a per-seat tool: CRM, dialler queue, cadences, booking, quotes, contracts, tasks, time, support, docs.
- **Buy the plumbing:** Twilio, Stripe, the email provider, Google, Supabase, the AI provider.
- **Every new connector gets a row in ROI › Build or buy:** subscription replaced, build hours, payback, verdict.

## 6. Security rules for all connectors
- **Secrets:**
  - kept in Supabase Vault and used only inside Edge Functions;
  - never in the browser, `VITE_` variables or git;
  - the repo is public.
- **Webhooks:** every inbound webhook is signed and idempotent (provider event ids stored).
- **Scopes:** OAuth asks for the smallest scopes and tokens are refreshed server-side. Disconnecting revokes the token.
- **Personal data:** follows the opt-out list and retention rules. The GDPR export and erasure cover connector data too.
