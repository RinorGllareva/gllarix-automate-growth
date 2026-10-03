# Sell › Deals and quotes (`/deals`, `/deals/:id`, `/q/:token`, `/c/:token`)

**Job:** build the right offer, send the quote, get the contract signed and the deposit paid.
**Who:**
- Admin, bdr, closer (sellers: their own deals).
- Accountant: read.

## Today (audit 2026-10-03)
- **Works:**
  - **List:** 4 KPIs; search; brand and owner filters; grouped DataTable with sorting.
  - **Builder:**
    - market, package editor, pilot, rush, annual, discount (with approval);
    - versioned quotes;
    - send the quote;
    - stage control (lost and won rules);
    - internal margin and commission;
    - tabs: history, contract, files, tasks, payments.
  - **Contract:** draft from the quote, edit, send, void, signing page, signed PDF.
- **Missing:**
  - no "+ New deal" on the list;
  - deals and quotes can't be deleted;
  - owner, brand or lead can't be changed;
  - an old quote version can't be reopened or duplicated;
  - no list export;
  - the contract is edited as raw text;
  - discount approvals across all deals are only visible in Settings;
  - no quote templates (saved packages);
  - no expiry or "quote viewed" alerts.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Deal | **"+ New deal"** with lead picker or inline lead creation | List, pipeline, deal page | Owner (founders), brand, expected close, stage, linked lead; custom fields | Delete if no quote was sent (founders); otherwise **Lost** |
| Quote | Save version (exists); **from a template** ("Standard Gllarix", "3D building + platform"); **duplicate a version** | Version history with a diff (what changed in price) | Draft only; expiry date; message to the client; resend; **extend expiry** | **Withdraw** a sent quote (the link stops working, with a reason) |
| Quote template | "Save as template" from a deal | Templates list (in Prices) | Edit | Delete |
| Discount request | Exists | **Approvals queue** for founders, inside Deals | Approve / reject (exists) | Withdraw by the requester |
| Contract | Exists | Exists | **Section editor** (headings as blocks, placeholders highlighted) instead of a raw textarea; counter-signature by a founder | Void (exists) |

**Views and sub-pages**
- **`/deals`:** list (exists). Add "+ New deal", saved views ("My open", "Waiting on client", "Quote expiring", "Discount requests"), and export.
- **`/deals/:id`:** builder (exists). The header gets a "Next step" card (the same rules as Deals to move).
- **`/deals/approvals`:** pending discounts and contracts waiting for the counter-signature.
- **`/deals/templates`:** quote templates (shared with Prices).

**Metrics:**
- open setup and monthly;
- won this month;
- waiting on the client;
- quotes expiring in 7 days;
- average discount;
- win rate by package.

**Automations**
- **Quote opened:** the owner is notified (exists as an event; add a push notification).
- **Not opened in 2 days:** call task (Deals to move).
- **Expiring in 2 days:** reminder email to the client, approved by the owner first.
- **Contract signed + deposit paid:** the deal is won, onboarding starts, commission lines are created.
- **Discount over the cap:** approval request to the other founder.

**Integrations:** Stripe Checkout for the deposit; e-signature (built in); PDF export of the quote (a real PDF, like the contract); email sending of the quote link from our domain.

**Priority**
- **P0:** "+ New deal"; change owner, brand and lead; delete or withdraw; approvals inside Deals.
- **P1:** quote templates; duplicate a version; expiry and reminders; list export.
- **P2:** contract section editor and counter-signature; win rate by package.
