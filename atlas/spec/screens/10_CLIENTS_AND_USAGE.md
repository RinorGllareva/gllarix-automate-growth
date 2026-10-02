# 10 — Clients and usage
**Route:** `/clients` (list + selected client) · `/clients/{id}` · **Mockup:** `Clients.dc.html` · **Milestone:** M7 · **Roles:** admin; implementer (clients, onboarding, usage; no finance totals); BDR (own clients, read-only)

## Purpose
After the sale: onboarding status, usage against included minutes, the next invoice and client health.

## Layout
- **Top bar:** "n CLIENTS · MRR $x · NEXT INVOICE <date>"; primary ONBOARDING (filters to clients in onboarding).
- **Left column:**
  - **Client cards:** name · status (LIVE / ONBOARDING / PAUSED / CHURNED / PROPOSAL) · plan and price · a progress bar (usage vs included for live clients; onboarding step for others) · a mono line ("1,420 / 1,250 min · +170 over" or "Step 2 of 5 · go-live 8 Dec"). The selected card is ice.
  - **Onboarding checklist** for the selected onboarding client (SOP 3): intake form received · agent drafted from the website FAQ · business number forwarded · automatic test calls pass · go live and start billing. ✓/○ each, with owner and date.
- **Main (selected client):**
  - **Header:** "<CLIENT> · <MONTH>", "Live since <date> · pilot rate" + SEND MONTHLY REPORT ↗ (email + PDF).
  - **4 KPI cards:** calls answered · after-hours calls captured · jobs booked · missed.
  - **Minutes per day chart:** bars for the month; bars after the included limit is passed are amber. Legend; label "x USED · y INCLUDED".
  - **Next invoice:** monthly (pilot rate if applicable) · overage (minutes × rate) · total.
  - **Health:** our usage cost (est., admin only) · margin after usage (admin only) · churn risk (Low / Medium / High, with the reason).

## Behaviour
- **Usage:** imported daily from the voice platform (`UsagePortal`).
- **Overage:** = max(0, used − included) × overage rate. Added as a Stripe invoice item at month end.
- **Health score:** usage vs normal 40% · bookings trend 30% · on-time payment 20% · tickets 10%. Under 60 → a call task within 48 h.
- **Status changes:** pause (keeps data; stops billing from the next period), cancel (final invoice; number release task; export data), each with a reason.
- **Onboarding steps:** can be ticked manually; automatic steps (drafted agent, test calls) tick themselves when the automation passes.

## Endpoints
- `GET /clients` · `GET /clients/{id}`
- `GET /partials/clients/{id}/usage?month=`
- `POST /clients/{id}/report`
- `PATCH /clients/{id}/status`
- `PATCH /clients/{id}/onboarding/{step}`

## Acceptance criteria
- [ ] Overage and the invoice preview match the formula for a seeded month
- [ ] The chart's amber bars start on the day cumulative use passes the included minutes
- [ ] The implementer can't see costs or margin
- [ ] The monthly report email + PDF contain the 4 KPIs and are logged
- [ ] Health under 60 creates a call task
