# Sell › Clients (`/clients`, `/clients/:id`)

**Job**
- **Implementer:** take each client from deposit to live in under 7 days.
- **Founders:** keep clients healthy, billed right and renewing.

**Who:**
- Admin, implementer.
- The demo data also lets sellers and the accountant read, but the menu doesn't: decide and align.

## Today (audit 2026-10-03)
- **Works:**
  - card list;
  - client page:
    - usage KPIs and chart per month;
    - next invoice;
    - health and margin;
    - support tickets;
    - files;
    - tasks;
    - invoices;
    - reports sent;
  - onboarding steps;
  - pause / resume / cancel;
  - send the monthly report;
  - export usage.
- **Missing:**
  - client contacts, plan and owner can't be edited;
  - no search, sort or filters;
  - no list metrics (MRR only in the top bar);
  - every load runs the billing jobs;
  - proposal cards send the implementer to a Forbidden deal page;
  - no renewal or upsell tracking;
  - no NPS or feedback.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Client | Automatic on deposit (exists); manual "Add existing client" (clients from before Atlas) | **DataTable** (name, plan, status, MRR, health, usage %, open tickets, owner, live since) + cards | Account manager, contacts (several, with roles: owner, billing, technical), plan change (upgrade / downgrade, from next period), billing email, business hours, notes | Cancel (exists, final invoice); archive after churn; GDPR erase |
| Onboarding step | From a template per product | Checklist (exists) | Done, assignee, due date; **add a custom step** | Remove a custom step |
| Plan change | "Change plan" → quote for the difference → client accepts | Plan history | — | Undo before the period starts |
| Feedback / NPS | Monthly question with the report | Score history | — | — |

**Views and sub-pages**
- **`/clients`:**
  - **Metrics:** MRR, clients live, onboarding, average health, at-risk count, usage over the cap.
  - **Views:** "Onboarding", "At risk", "Over usage" (upsell), "Renewing".
- **`/clients/:id`:** the standard record page. Tabs: **Overview** (usage, health), **Onboarding**, **Billing**, **Support**, **Files**, **Reports**, **Activity**.
- **`/clients/onboarding`:** a board of onboarding clients by step, with days since the deposit (coral past 7).
- **Client portal (later):** `/portal` for the client. Their reports, invoices, tickets and files, with a magic link login.

**Metrics:**
- MRR and net revenue retention;
- days deposit → live;
- health distribution;
- usage over plan, as an upsell list;
- churn this quarter.

**Automations**
- **Deposit paid:** client created, onboarding tasks, kickoff email.
- **Health below 60:** a call task for the account manager (exists as a health task).
- **Usage over the cap 2 months running:** an upsell task with a ready quote.
- **Month end:** report sent (exists), invoice (exists), NPS question.
- **Ticket overdue:** health drops (exists via tickets).

**Integrations:** the voice platform usage API; Stripe subscriptions; the client portal (magic link).

**Priority**
- **P0:** edit contacts, plan and owner; search and table view; the implementer's Forbidden link; stop running billing on every load (run it as a job).
- **P1:** metrics strip and views; onboarding board; plan changes.
- **P2:** NPS; client portal.
