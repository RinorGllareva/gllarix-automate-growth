# People › Bonuses and commissions (`/commissions`)

**Job**
- **Sellers:** see what they've earned and when it's paid.
- **Founders:** approve the statements.
- **Accountant:** pay everyone by the 5th.

**Who:**
- Founders and the accountant: everyone.
- Sellers: themselves.

## Today (audit 2026-10-03)
- **Works:** 4 KPIs (pending, earned, paid, clawed back); lines table with status chips; lines are created automatically.
- **Missing:**
  - **no way to mark lines paid**, approve a statement, claw back or void. Month-close sends the accountant here, and nothing can be done;
  - no filter by person or month;
  - no statement export;
  - totals use only the first row's currency.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Commission line | Automatic (approved meeting $15; setup and recurring commission on cash collected; quarter bonus); manual adjustment by founders with a reason | Table: person, period, type, source record (meeting or deal), amount, status, earnable date | Status: pending → earned (after the 30-day clawback window) → paid; **claw back** (client refunded or cancelled in the window); **void** with a reason | Never delete: void instead |
| Statement | Automatic per person per month at month close | Statement page: lines, totals per currency, status | Founders **approve**; accountant **mark paid** (date, method, reference, proof file) | Reopen (founders, with a reason) |
| Payout | Created when a statement is marked paid | Payout history per person | — | Reverse (founders) |

**Views and sub-pages**
- **`/commissions`:** this month's statements (one row per person), each with a status chip: Draft, Approved, Paid.
- **`/commissions/:person/:month`:** the statement. Every line links to its meeting or deal. "Download PDF", "Approve", "Mark paid".
- **`/commissions/lines`:** all lines, filterable by person, month, type and status.
- **Seller view:** "My money": this month, next payday, what's waiting for approval, history. It replaces the table for sellers.

**Metrics:** to pay by the 5th (per currency); approved vs waiting; paid this year per person; claw-backs this quarter.

**Automations**
- **On the 1st:** statements are drafted, founders get "Approve statements", and once approved the accountant gets "Pay by the 5th".
- **When a client refunds inside the window:** a claw-back line is created and the seller is told why.
- **When a statement is paid:** the seller gets a notification with the PDF.

**Rules:** totals are always shown per currency, never added across currencies. The reason is required for every manual change, and every change is audited.

**Priority**
- **P0:** approve, mark paid, void and claw back; filters by person and month; totals per currency.
- **P1:** statement page and PDF; seller "My money" view.
- **P2:** payout history; automatic month-start flow.
