# Growth › Outreach cadences (`/cadences`)

**Job:** design the multi-touch sequences (call, email, LinkedIn, SMS) that every lead follows, and see which ones book meetings. This replaces Lemlist, Apollo sequences and Instantly.
**Who:** founders design; sellers see their leads' steps.

## Today (audit 2026-10-03)
- **Works:** cadence steps shown (from config); email templates editable (subject and body), with validation and a preview.
- **Missing:**
  - **cadences are code**: no add, remove or reorder of steps, and no new cadence;
  - **templates can't be created, deleted or duplicated** (some are marked "To write");
  - the preview shows only the saved version;
  - no performance numbers per step or template;
  - no A/B tests;
  - no sending limits or warm-up per inbox;
  - no reply handling settings.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Cadence | "+ Cadence": name, list/brand/market it's for, exit rules (reply, meeting, opt-out, bounced) | Cards → **cadence page** with step timeline and stats | Steps: **add / remove / reorder / change day**; step types: call (goes to the queue), email (template), LinkedIn task, SMS (where allowed), wait, branch (opened? replied?); pause / activate; send window per market | Archive (leads on it finish their current step or move to a chosen cadence) |
| Email template | **"+ Template"**, duplicate | Library with variables, language, brand | Edit with **live preview of the draft** on a real lead; spam/claim check (reuse Marketing's claim checker) | Delete if unused |
| A/B variant | "Add variant B" on a step | Split and results | Weights, pick a winner | Remove |
| Enrolment | Add leads (bulk from Leads, exists) | Who is on it, at which step | Pause / skip step / remove a lead | Remove |
| Sending inbox | Connect Google Workspace / Resend domain | Health: daily limit, warm-up, bounce rate | Limits per day, signature | Disconnect |

**Views and sub-pages**
- **`/cadences`:** a cadence list with enrolled count, reply rate and meetings booked.
- **`/cadences/:id`:** a step timeline (visual), per-step stats (sent, opened, replied, booked) and enrolled leads.
- **`/cadences/templates`:** the template library and editor.
- **`/cadences/inboxes`:** sending inboxes and deliverability. This moves from Settings › Integrations.

**Metrics:**
- active enrolments;
- reply rate;
- meeting rate per cadence;
- bounces;
- unsubscribes;
- best template.

**Automations**
- **Reply detected:** the cadence stops and the owner gets a task with the reply.
- **Bounce:** the email is marked invalid, and the step is skipped to a call.
- **Opt-out:** stop everywhere (exists).
- **Template with a reply rate under 1% after 200 sends:** suggest replacing it.

**Integrations:** email provider (Resend or Postmark) with reply parsing; Google Workspace inboxes; LinkedIn as manual tasks (no scraping); SMS through Twilio, only where the country rules allow it.

**Priority**
- **P0:** create, duplicate and delete templates; preview the draft.
- **P1:** cadences in the database with a step editor; per-step stats.
- **P2:** A/B variants; branches; inbox health.
