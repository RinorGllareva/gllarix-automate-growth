# Money › Payments (`/payments`)

**Job:** see cash coming in, chase every late invoice, and match Stripe to the books.
**Who:**
- Founders: chase, refund, credit.
- Accountant: match and export.

## Today (audit 2026-10-03)
- **Works:**
  - 4 KPIs (collected this month, MRR, open invoices, late invoices);
  - 6-month collected chart;
  - open invoices with the next dunning step;
  - payments table with type chips.
- **Missing:**
  - fully read-only: no manual payment, refund, credit note, reminder or "mark paid";
  - no status, client or date filters;
  - the accountant clicks into Clients and Deals and gets "Forbidden" (links to pages their role can't open).

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Invoice | Automatic (Stripe or month-end job); manual one-off invoice for custom work | Table: number, client, period, total, due, status, dunning step, days late | Send reminder (template), extend due date with a note, mark paid manually (bank transfer, with proof), add a line before sending | Void with a reason (never delete) |
| Payment | Automatic from Stripe; manual for bank transfers | Table: date, client, type, amount, method, invoice matched ✓, Stripe id | Match to an invoice (accountant), add a note | Refund (full or partial) → creates a refund row; nothing is deleted |
| Credit note | From an invoice: "Credit…" with amount and reason | Listed under the invoice | — | Void |
| Dunning step | Automatic ladder (day 3 email, day 7 call, day 14 pause, day 30 cancel) | Timeline on the invoice | Skip a step or pause the ladder with a reason | — |

**Views and sub-pages**
- **`/payments`:** overview with tabs **Invoices**, **Payments**, **Late**, **Refunds**.
- **`/payments/invoices/:id`:** the invoice record:
  - lines;
  - PDF;
  - payments and credit notes;
  - dunning timeline;
  - client link;
  - "Send reminder" or "Call the client" actions.
- **`/payments/reconcile`:** for the accountant. Stripe payouts on the left, bank lines on the right, auto-matched pairs, and the leftovers to match by hand.

**Metrics:** collected this month vs plan; MRR and its change; open invoices; late invoices with the € amount at risk; DSO (average days to pay); failed payments this month.

**Automations**
- Each dunning step creates the email or task automatically, and a founder approves anything before it goes to the client.
- A payment that fails 3 times pauses the client's service, but only after a founder confirms.
- When an invoice is paid, the client report is unlocked and a "thank you" email goes out (optional).

**Integrations**
- **Stripe:** invoices, payments, refunds, payouts and webhooks.
- **Bank CSV:** for reconciliation.
- **Accountant export:** feeds the month close.

**Layout and access**
- Standard list page with tabs as saved views.
- Every link the accountant sees must open a page they can access. Use the invoice record, not Clients or Deals.

**Priority**
- **P0:** filters (status, client, date); fix the accountant's dead links; send reminder; mark paid manually.
- **P1:** invoice record page; refunds and credit notes; reconcile view.
- **P2:** DSO; auto-pause rules.
