# Work › Support (`/support`, `/support/:id`)

**Job:** answer and fix client issues inside the service levels, most urgent first.
**Who:** founders, implementer.

## Today (audit 2026-10-03)
- **Works:**
  - 4 KPIs;
  - filter pills;
  - urgency sort;
  - new ticket;
  - reply or internal note;
  - status, owner and priority;
  - resolve and reopen;
  - client section;
  - health impact;
  - "Needs a founder" line.
- **Missing:**
  - no search;
  - no filters by client, category or priority;
  - no sort control;
  - subject, category, channel and client can't be edited;
  - messages can't be edited or deleted;
  - no attachments;
  - no delete, bulk actions or export;
  - **tickets only come in by hand** (no email-to-ticket);
  - the client never sees our reply (no email out).

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Ticket | Manual (exists); **email to `support@`** (matched to the client by sender domain); **client portal form**; **from an inbound call** (demo line); from an automation (usage dropped to 0 → "Receptionist down?") | DataTable with **search** and filters (client, category, priority, owner, status, overdue); board by status | All fields incl. subject, category, client, channel; merge duplicates; link to a task (fix in Tasks) | Spam/delete (founders); otherwise resolve |
| Message | Reply (**sent by email** from our domain) / internal note (exists); attachments; **canned replies** | Thread | Edit your own note | Delete your own note |
| Canned reply | In settings, per category | Picker in the reply box | Edit | Delete |
| SLA policy | Settings: per category and priority, business hours per client | Shown on each ticket | Edit | — |

**Views and sub-pages**
- **`/support`:** exists. Add the ViewBar, saved views ("Mine", "Overdue", "Waiting on client > 3 days") and bulk assign/resolve.
- **`/support/:id`:**
  - exists;
  - add attachments, canned replies, linked task, a client sidebar (plan, health, recent usage) and merge.
- **`/support/settings`:** SLA policies, canned replies, the inbound email address and auto-replies.

**Metrics:**
- needs us;
- past the service level;
- first reply on time % (computed on the server);
- average resolution time;
- tickets per client per month;
- CSAT (one-click rating after resolving).

**Automations**
- **New urgent ticket:** alerts (exists).
- **Waiting on the client for 3 days:** a nudge email; at 7 days, auto-resolve with a note.
- **Resolved:** a CSAT email.
- **Recurring issue (same category 3 times in 30 days):** a task to fix the cause.

**Integrations:** an email inbox (Postmark or Resend inbound) for `support@`; Slack alerts; the client portal; the voice platform health checks.

**Priority**
- **P0:** search and filters; edit all fields; replies sent by email; attachments.
- **P1:** email-to-ticket; canned replies; bulk actions; CSAT.
- **P2:** SLA policies in settings; client portal; recurring-issue detection.
