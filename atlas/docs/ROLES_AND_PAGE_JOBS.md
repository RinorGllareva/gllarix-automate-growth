# Who uses which page, and why (2026-10-02)

**Rule:** every page has a job for each role that can open it: what the person comes to do, and what "done" looks like. If a role has no job on a page, that role doesn't get the page.

- **Where the jobs live:** `src/config/pageJobs.ts`.
- **Where people see them:** a one-line "why you're here" note on each page. "Hide tips" turns it off, and the user menu turns it back on.
- **How it's enforced:** a test fails if any page in a role's sidebar has no stated job.

## By person

### Rinor (founder, weekends)
- **Today** opens with **"Needs a founder"**: one list of everything waiting for a decision.
  - Meetings to approve.
  - Inbound waiting.
  - Late invoices.
  - Proposed spends.
  - Decisions due for review.
  - SOPs past due.
  - Setups piling up.
  - Candidates at the trial week or offer.
  - Stale competitor prices.
  - Cash below the reserve, or no cash snapshot this month.
- **Training › Objections heard:** the objections BDRs log on calls in the last 30 days, flagged "Write it" when no approved answer exists. Three or more unanswered hits put a line in "Needs a founder".
- **Growth › Automations › Runs by itself:** what Atlas did on its own in the last 30 days, with the manual minutes each run replaces (estimates in `config/systemAutomations.ts`). The automations are the call queue, cadences, meeting emails, send-info, nightly rescore, inbound routing, daily BDR report and task rules.
  - Founder hours are priced at €87.50.
  - BDR hours are shown as extra dials, because a BDR hour isn't worth a founder hour.
- **ROI › Build or buy** measures every build in his weekends (~7.5 h of delivery each): a weekend spent on a build is a weekend without a client setup.

### Co-founder (operations, Europe, finance close)
- **Today:** the same "Needs a founder" list.
- **Operations plan:** the weekly rhythm as a checklist.
- **Finance and payments:** the month-end close.
- **Hiring and training:** the BDR pipeline.
- **Marketing and markets:** the developer outreach.

### BDR (Diego)
- **Today:**
  - his queue;
  - **Inbound waiting**, highlighted red once a request is past 15 minutes;
  - callbacks due;
  - **"Your money this month"**: meeting bonuses, commission, and the bonuses still waiting for approval, paid by the 5th, never from AI scores.
- **Sell app pages:** Today, Inbound, Call workspace, Leads, Pipeline, Meetings, Deals.
- **Elsewhere:** his tasks, scorecard, training gate, bonuses, the messaging kit and the routine.
- **Today › Deals to move:** his open deals that need him, in order:
  1. a meeting in the next 24 h (prep);
  2. deposit paid (mark won), or quote opened a day ago (ask for the deposit);
  3. quote not opened after 2 days (call);
  4. quote drafted but not sent, or no quote and no next meeting.
  Deals where the client has the ball and it's still fresh are left out.
- **Call workspace** (his most-used page):
  - his day against the targets (dials 60, conversations 6, meetings 4 a week) and the bonus waiting for approval, refreshed after every call;
  - inbound waiting shown above the dialler, because speed-to-lead beats the queue;
  - the last call with this business, so he never opens cold twice;
  - one-tap callback times and skip reasons;
  - the $15 bonus shown when booking.
  - Tapping an objection logs it in the notes. If the answer isn't written yet, he sees a safe move instead of improvising a claim.
- **Removed:** Market and competitors. Channel rules are enforced on every call and send, so it had no job for him.

### Accountant (viewer)
- **Finance opens with "Close <last month>":** six checks, each linking to where it's fixed. The month is closed when all six are green, and statements are paid by the 5th.
  1. Bank balance at month end.
  2. Costs logged.
  3. Invoices collected.
  4. Stripe payments match.
  5. Meeting approvals locked. This line is a founder's job; the accountant sees it without a link.
  6. Statements paid.
- **Now sees:** Finance (expenses and cash, read-only), Payments, Bonuses and commissions (every statement, to pay by the 5th), Reports and Pipeline value.
- **No longer sees:** Team performance, Marketing, Market and competitors. None of those had a job for the books.

### Implementer
- **Sees:** Clients (onboarding to go-live), Tasks, Time (hours per client), Operations plan (onboarding SOP, service levels).
- **No longer sees:** Growth › Automations, which is founders only now.

## New pages (2026-10-02, second round)
- **Support** (founders, implementer): answer and fix client issues inside the service levels. Overdue tickets reach "Needs a founder".
- **Docs and wiki** (everyone):
  - founders keep the handbook and finish the move off Notion;
  - sellers look up the playbook;
  - the implementer follows the SOPs;
  - the accountant finds the month-end procedure.
- **AI BDR agent** (founders): calls back inbound requests within minutes and books them with a human. It never cold-calls.
- **AI performance tracker** (founders see everyone, a seller sees their own): the week against targets and one focus for the 1:1. Never pay.
- **Deal › Contract** (sellers on their own deals, founders): send the agreement and get it signed.
- **Meeting page** (whoever runs or booked the meeting, founders): prep, notes, outcome and next steps.

## Build or buy (ROI page)

**Rule** (spec/backbone/09): build what makes us win, buy the plumbing. An hour is worth €87.50 (€700 a day). Core work is built if it pays back within 12 months; commodity work only within 6.

**Already built into Atlas.** These are 15 tools we don't need to buy:

| Atlas has | Instead of paying for |
|---|---|
| CRM | HubSpot, Pipedrive, Zoho |
| Power-dialer queue | Close, Aircall (the phone line stays on Twilio) |
| Outreach cadences | Apollo, Lemlist, Instantly |
| Booking page | Calendly |
| Quotes | PandaDoc (e-signed contracts still to do) |
| Tasks | ClickUp, Asana, Notion |
| Time tracking | Toggl, Harvest |
| Dashboards | Databox |
| Call coaching | Gong |
| Hiring | Workable |
| Training | An LMS |

Also built in: client reports, the finance dashboard, the inbound inbox, and the AI co-founder on our own data.

**Current subscriptions:**

| Verdict | Items | Why |
|---|---|---|
| Keep | Google Workspace, Supabase, US number + dialer, demo-line usage, lead data, Wise fees, BDR pay | Plumbing, data or people |
| Replace | Call recorder ($15/mo, ~€157 a year) | Record through Twilio inside the call workspace once real calling is live |

**Calculator:** enter the price per seat, seats, build hours and monthly upkeep. It shows the 12-month cost of each option, the payback time, and how many of Rinor's weekends the build takes. "Log the decision" records the verdict in the decision log with a stop rule.

## What changed in the code
- **Page jobs:** `config/pageJobs.ts`, plus `components/shell/PageJob.tsx` and its switch in the user menu.
- **Access** (`lib/nav.ts`):
  - BDR and closer lose Market and competitors.
  - The accountant gets Finance, Payments and Commissions, and loses Team, Marketing and Markets.
  - Automations is founders only.
  - The demo data now lets the accountant read finance data, payments, invoices and all commission lines. Writing stays with the founders.
- **Today:** `pages/today/RoleCards.tsx` adds "Needs a founder", "Inbound waiting" and "Your money this month".
- **Build or buy:** `config/buildVsBuy.ts` and `pages/money/BuildVsBuy.tsx`, on the ROI page.
- **Tests:** `test/pageJobs.test.ts` checks that every sidebar page has a job for its role, and tests the build-or-buy maths and the subscription verdicts.
