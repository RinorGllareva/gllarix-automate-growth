# Growth › Market and competitors (`/markets`)

**Job:** choose which markets to sell in, know each one's rules, and keep competitor prices current so our offer wins.
**Who:** founders.

## Today (audit 2026-10-03)
- **Works:**
  - markets table with live counts and the channel rule per market;
  - competitor map (create, edit, "checked today");
  - brand toggle.
- **Missing:**
  - markets are read-only (no add or edit);
  - competitors can't be deleted;
  - the "Account rules" section is static text;
  - prices are checked by hand with no reminder workflow;
  - no win/loss against a competitor;
  - no market scoring.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Market | **"+ Market"**: country/region, currency, price level, language, time zones, status (exploring / testing / active / paused) | Table with live numbers (leads, A/B, contact rate, meetings, clients, MRR) | Status, notes, owner, price level; country rules link to Settings › Country rules | Pause / archive |
| Competitor | Exists | Map | Exists + **price history** (every check stored), features, where they win, our counter-pitch | **Delete / archive** |
| Win/loss note | From a lost deal: "Lost to …" (competitor picker) | Per competitor: deals lost/won against them, reasons | — | — |

**Views and sub-pages**
- **`/markets`:** market table and a scorecard (size, our conversion, price fit, legal ease) to decide where to expand.
- **`/markets/:country`:**
  - the market page;
  - rules (from Country rules);
  - lists;
  - price level;
  - competitors active there;
  - results.
- **`/markets/competitors`** and **`/markets/competitors/:id`:** a competitor record with price history and a battle card. The battle card is shown to sellers in the call workspace when the prospect mentions that competitor.

**Automations**
- **Competitor price older than a quarter:** task ("Needs a founder" exists).
- **A deal lost to a competitor:** added to their record, and the battle card is reviewed when there are 3 or more losses.

**Priority**
- **P0:** delete or archive competitors; markets editable.
- **P1:** market pages; price history; win/loss from lost deals.
- **P2:** battle cards in the call workspace; market scorecard.
