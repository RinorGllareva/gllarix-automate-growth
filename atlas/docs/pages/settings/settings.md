# Settings (`/admin/:section`), 11 sections

**Job:** make Atlas work the way the company does: users, rules, prices, integrations, data.
**Who:** founders.

**Biggest problem today:** most settings live in code (`src/config/*`), so changing a target, a cadence step, a price or a scoring weight needs a developer. The goal is that **every business rule is editable here, versioned and audited**, and code only holds defaults.

| Section | Today (audit 2026-10-03) | Must have |
|---|---|---|
| **Users** | Read-only table; "Invite" disabled | Invite by email (magic link); edit role, daily capacity, time zone, active; deactivate with "hand over leads, deals and tasks to…"; reset 2FA; per-person permission overrides; last active |
| **Settings (company)** | Branding (footer, demo phone) editable; queue and commission settings read-only "live in src/config" | Company profile (legal entities per brand, addresses, VAT ids: these fill the contract placeholders); working hours; holidays; currencies and the planning rate; **queue settings** (capacity, windows, tier mix) and **commission plan** (amounts, percentages, clawback days) editable with an effective date |
| **Country rules** | Read-only table; retention months editable; nightly job log | Edit each country's rule (call / email / SMS, hours, required screens, notes, verified by counsel + date); add a country; history of changes |
| **Scoring** | Monthly report; rules read-only ("weights editing is M2") | Edit rules and weights in a **draft model** → preview the tier changes on current leads → activate (versioned, rescore at night); "suggest weights" when enough data |
| **Cadences** | Same as Growth | Move to Growth only; remove from Settings |
| **Price book** | Read-only; parity check | Move to Money › Prices (versions); keep a link here |
| **Opt-out** | Add, remove with a reason, search | CSV import/export; bulk add; source and date; "check a number/email" lookup |
| **Jobs** | List build, enrichment, pause/resume, retry | Every background job (sender, nightly, billing, alerts, calendar sync, coaching) with schedule, last run, duration, errors, run now, pause |
| **AI co-founder** | Role access, tool switches, € cap | Plus model choice per feature, spend per feature per month, the prompt version (read-only; the prompts stay on the server) |
| **Integrations** | Fake mailbox (3 test inboxes), Places / Companies House "connected (demo)", Zefix off, CSV; Twilio, Stripe, voice, transcription and AI "connect in their milestones" | The connector framework from `01-INTEGRATIONS-AND-PLUGINS.md`: each connector with status, connect/disconnect, scopes, last sync, errors, cap; inbound and outbound webhooks; API keys |
| **Audit log** | Read-only list, before/after drawer | Filters (person, entity, action, date), search, export, retention |

**New sections to add**
- **Fields:** custom fields per entity.
- **Pipelines and stages:** stages, probabilities and limits.
- **Templates:** email, task, project, quote and contract templates, all in one place.
- **Import and export:** the shared Import Center and scheduled exports.
- **Trash:** restore or purge deleted records.
- **Notifications:** defaults per role, Slack and WhatsApp channels.
- **Billing of Atlas itself:** usage of Twilio, the AI, email and storage against caps.
- **Security:** sessions, 2FA required for admins, login history.

**Layout:** a left section nav (exists). Every section uses the standard list page for its entities. Versioned settings show "Draft · Active · History" tabs.

**Priority**
- **P0:**
  - user management (invite, edit, deactivate with hand-over);
  - company profile (fills the contract placeholders);
  - queue and commission settings editable.
- **P1:**
  - country rules editable;
  - scoring drafts;
  - integrations framework;
  - audit filters;
  - Trash;
  - Fields.
- **P2:** jobs monitor for all jobs; notifications; security; Atlas usage billing.
