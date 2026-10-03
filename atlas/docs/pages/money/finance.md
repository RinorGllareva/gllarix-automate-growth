# Money › Finance (`/finance`)

**Job:** know where the money goes, keep the runway above the €3,000 reserve, and close each month by the 5th.
**Who:**
- Founders: full edit.
- Accountant: read, reconcile, close.

## Today (audit 2026-10-03)
- **Works:**
  - month-end close checklist;
  - 4 KPIs (cash, monthly costs, runway, number of expenses);
  - expense list with category chips;
  - cost by category;
  - cash snapshots;
  - add expense and add cash snapshot (admin).
- **Missing:**
  - expenses and snapshots can't be edited or deleted;
  - no note field on an expense;
  - no search, date range or recurring/one-off filter;
  - no column sort;
  - no bank import or export;
  - snapshots are EUR only;
  - the accountant can't mark anything reconciled.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Expense | Form with vendor (autocomplete from past vendors), category, amount, currency, date, recurring (monthly/yearly), note, receipt file. Also import from a bank CSV. | DataTable: date, vendor, category, amount (original + EUR), billing, source, receipt, reconciled ✓ | Inline edit of every field; "End this subscription from…" for recurring ones | Soft delete with undo; blocked once the month is closed (then "correct in next month") |
| Recurring subscription | Created from an expense marked recurring | Separate "Subscriptions" view: next charge date, yearly cost, Build-or-buy verdict | Change price or cycle; cancel date | Cancel (keeps history) |
| Cash snapshot | Per account (bank, Wise USD, Wise EUR, Stripe balance), any currency | Line chart of cash over time + table | Edit | Delete with undo (not in a closed month) |
| Month close | Automatic for last month | Checklist (exists) | Accountant ticks "reconciled", founders "closed" | Reopen (founders, with a reason, audited) |

**Views and sub-pages**
- **`/finance`:** overview. Metrics: cash, monthly burn, runway, this month's spend vs budget, unreconciled count.
- **`/finance/expenses`:** the full table, with saved views like "This month", "Unreconciled", "Subscriptions" and "No receipt".
- **`/finance/subscriptions`:** every paid tool with its next renewal and verdict (keep, replace or review). This is the anti-SaaS-fees page.
- **`/finance/budget`:** a monthly budget per category (set by founders), with actual vs budget bars and an alert at 90%.
- **`/finance/close/:month`:** the month-end close as a page:
  - checklist;
  - notes;
  - attachments (bank statement PDF);
  - "Export accountant pack" (XLSX: expenses, payments, invoices, payouts);
  - lock.

**Metrics (each clickable)**
- Cash on hand, with the change vs last snapshot.
- Monthly burn: recurring plus a 3-month average of one-offs.
- Runway in months, with a coral alert under 6.
- Spend this month vs budget.
- Unreconciled lines.
- Subscriptions renewing in 14 days.

**Automations**
- Recurring expenses add themselves on their charge date. You can confirm the amount, or it posts automatically.
- Cash below the reserve: alert both founders, and a line in "Needs a founder".
- A subscription renewing in 7 days with verdict "replace": a task for a founder.
- On the 1st, the close checklist opens and the accountant gets a task.

**Integrations**
- **Bank import:** CSV or Wise, with a saved column mapping and duplicate detection on date, amount and vendor.
- **Stripe:** fees post as expenses automatically.
- **Accountant export:** in the format of the tool chosen (Bexio, Xero or QuickBooks).
- **Receipts:** forward an email with an attachment to `receipts@` and it's matched to an expense.

**Layout**
- Standard list page: metrics, then the ViewBar, then a DataTable.
- The right panel opens the expense record (receipt preview, history).
- **Close:** a checklist page with a sticky "Lock month" button.

**Priority**
- **P0:** edit and delete expenses and snapshots; note and receipt fields; search, date filter and sort.
- **P1:** subscriptions view; bank CSV import; accountant export; reconciled flag.
- **P2:** budget; snapshots per account and currency; receipt email.
