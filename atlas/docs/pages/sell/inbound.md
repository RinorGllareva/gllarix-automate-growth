# Sell › Inbound (`/inbound`)

**Job:** answer every person who asked us to contact them within 15 minutes, and turn the good ones into leads.
**Who:** admin, bdr, closer.

## Today (audit 2026-10-03)
- **Works:**
  - 4 KPIs (waiting, % within target, median first reply, became leads);
  - status tabs with counts;
  - claim, mark replied, convert to lead (with lead matching), dismiss as not a fit or spam;
  - test request simulator (admin).
- **Missing:**
  - no search;
  - no filter by channel, brand or assignee;
  - no reassign or unclaim;
  - no undo for a dismissal;
  - a reply note can't be entered (the API supports it);
  - no detail view;
  - no real sources: website forms and the demo line don't post here yet.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Inbound request | **Automatic** from website forms, the demo line, the booking page, referrals, chat, the Google profile (generic inbound webhook per source); manual "Log a request" (phone call, walk-in, WhatsApp) | DataTable or cards: received, waiting time (live), channel, brand, name, company, message, owner, status; search; filters | Claim, **reassign**, reply (call / email / WhatsApp, with a note and the template used), convert to lead or **attach to an existing lead or client**, mark spam / not a fit | Dismiss with undo; spam is learned (same sender auto-flagged) |
| Routing rule | In settings: round-robin, by brand, by country, by hours | Rules list | Edit, reorder | Delete |

**Views and sub-pages**
- **`/inbound`:** "To answer" first (oldest at the top, with a red timer past 15 minutes), plus tabs.
- **`/inbound/:id`:** the request record:
  - full message and form fields;
  - matched lead or client;
  - reply composer with templates;
  - call button;
  - activity.
- **`/inbound/sources`:** each source with its webhook URL, test button, volume per week and conversion. This is where the website form gets connected.
- **`/inbound/rules`:** routing rules and the response target.

**Metrics:** waiting now; % answered in 15 minutes this week; median first reply; inbound → meeting rate per channel; cost per inbound lead (from Marketing spend).

**Automations**
- **New request:** routed to an owner, then push and Slack, and an auto-reply email ("we'll call you in the next 15 minutes").
- **15 minutes unanswered:** escalate to the founders and the AI BDR agent (if it's on), and show in "Needs a founder".
- **Converted:** lead created with source = channel, put into the "Inbound" cadence, and the meeting booking link sent.

**Integrations:** website forms (generic webhook), the demo line (Twilio), the booking page, chat widget, the Google Business Profile, WhatsApp Business.

**Priority**
- **P0:** search and filters; reassign; reply note; undo dismiss; request detail.
- **P1:** sources page with webhook URLs (real website forms); routing rules; auto-reply.
- **P2:** cost per inbound lead; spam learning.
