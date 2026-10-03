# Money › ROI and investment (`/roi`)

**Job:** decide whether a spend, a tool or a build is worth it, log the decision with a stop rule, and check later whether it paid off.
**Who:** founders.

## Today (audit 2026-10-03)
- **Works:**
  - unit economics (plan vs actual);
  - "What to fund next";
  - ROI calculator with chart and 3 examples;
  - Build or buy (subscription verdicts, list of tools already built into Atlas);
  - "Split money in";
  - log a spend decision.
- **Missing:**
  - logged spends can't be approved, rejected, edited or closed: they stay "proposed" forever;
  - calculator inputs aren't saved;
  - subscription verdicts come from vendor names in code, with no override;
  - no look-back: did the spend actually return what we expected?

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Spend decision | From the calculator or Build or buy (exists) | Table: what, amount, expected return, payback, stop rule, status, review date, result | Workflow: **proposed** → **agreed** (needs the other founder) / **rejected**; then **running** → **kept** / **stopped**, with the actual result filled in | Delete a draft; closed decisions only archive |
| Subscription verdict | Automatic for each recurring expense | In Build or buy | Override the verdict with a reason; set "replace by" (an Atlas feature or task) | — |
| Build item | "Build it ourselves" → creates a task in Development with an estimate | Linked to the decision | Hours logged in Time count against the estimate | — |

**Views and sub-pages**
- **`/roi`:** overview: unit economics, what to fund next, and decisions waiting for the other founder.
- **`/roi/decisions`:** the decision log (DataTable) with saved views "Waiting for OK", "Running", "Due for review" and "Closed".
- **`/roi/decisions/:id`:** the decision record:
  - the calculator inputs, frozen at the time of the decision;
  - the stop rule;
  - linked expenses and tasks;
  - actual vs expected chart;
  - comments between the founders.
- **`/roi/build-or-buy`:** every tool we pay for or considered, with its verdict and payback.

**Metrics**
- Spend agreed this quarter.
- Running spends paying back on time.
- Money saved by building (yearly subscription cost replaced).
- Founder weekends spent on builds.

**Automations**
- When a decision reaches its review date, both founders get a task; it shows in "Needs a founder" with "Keep or stop?".
- When a stop rule triggers (e.g. "no meeting from this channel after €300"), alert the founders and propose stopping.

**Priority**
- **P0:** the approve/reject workflow (two founders); edit and close decisions.
- **P1:** decision record page with actual vs expected; verdict override.
- **P2:** link builds to Time hours; savings metric.
