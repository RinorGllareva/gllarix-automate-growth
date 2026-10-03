# Money › Prices and calculator (`/prices`)

**Job:** keep the price book that every quote uses up to date, and answer "what would this cost?" in 10 seconds.
**Who:** founders edit. Sellers read, and use the calculator.

## Today (audit 2026-10-03)
- **Works:**
  - price book shown from config (`config/priceBook`): market levels, discount rules, one table per brand;
  - parity check.
- **Missing:**
  - **no calculator on the page**: the "calculator" is a link to Deals;
  - nothing is editable: prices live in code; versioning is a placeholder ("arrive when the price book moves to the database");
  - no search;
  - the header is reused from Settings;
  - sellers can't open it.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Price book version | "New version" copies the active one into a draft | Version list: active, drafts, history; diff between versions | Edit the draft: items, setup and monthly prices per market, included minutes, overage rate, pilot terms, discount caps | Delete a draft. Activating needs the other founder's OK; old versions stay for quotes that used them |
| Item (package or add-on) | Add to a draft: brand, group, name, description, setup, monthly, unit, availability per market | Searchable table | Edit in the draft | Remove from the draft |
| Market | Add a market: currency, price level, VAT note | Market table | Edit | Retire (hidden from new quotes) |

**Views and sub-pages**
- **`/prices`:** the **calculator** first.
  - Pick a market, a package and options (pilot, rush, annual, discount).
  - It shows setup, monthly, first-year value and our margin.
  - Actions: "Copy as text", "Create a quote for a lead…".
  - It uses the same `compute()` as the deal page, so the numbers never differ.
- **`/prices/book`:** the active price book, searchable and filterable by brand and market.
- **`/prices/versions`:** drafts, diff and activation.
- **`/prices/competitors`:** our price next to competitors (from Markets), per market.

**Metrics:** average margin per package; number of quotes on old versions still open; discount given this month vs the cap.

**Automations**
- When a version is activated, the owners of open quotes on the old version are told, and asked whether to requote.
- When margin drops under 50% for a package (because usage cost changed), alert the founders.

**Access:** sellers get the calculator (read-only). This is part of the BDR's job when a prospect asks "how much?".

**Priority**
- **P0:** the calculator on this page; sellers can open it.
- **P1:** price book in the database with versions, draft/activate and diff.
- **P2:** margin alerts; competitor column.
