# Work › Operations plan (`/ops`)

**Job:** run the weekly rhythm, get the SOPs written, and see delivery capacity before it breaks.
**Who:**
- Founders: edit.
- Sellers and implementer: read and tick their rhythm items.

## Today (audit 2026-10-03)
- **Works:**
  - rhythm checklist per period, with overdue items in amber;
  - delivery capacity with the "hire implementer" trigger;
  - SOP status and link (marking done needs a link);
  - static tables: who does what, compliance, vendors, risks, service levels.
- **Missing:**
  - once a SOP link is set it can't be changed or cleared;
  - SOP owner and due date have no UI;
  - SOPs can't be added or removed;
  - **all the other tables are static config** (who does what, compliance, vendors, risks, service levels);
  - who ticked an item and when is stored but not shown;
  - the SOP deadline is hard-coded;
  - no history of past periods.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Rhythm item | "+ Item": title, cadence (daily / weekly / monthly / quarterly), role, day, link to the page where it's done | Checklist per period + **history** (who ticked, when) | Edit, reassign, pause | Delete |
| SOP | **"+ SOP"**: title, owner, due, area | Table: status, owner, due, link to its **Docs page** | Status, owner, due, **link editable**; "Write it" creates the page in Docs and links it | Delete / archive |
| Responsibility (RACI) | "+ Responsibility" | Who does what table | Edit (owner, backup) | Delete |
| Vendor | "+ Vendor": what, cost (→ Finance subscription), owner, contract end, data processed (GDPR) | Vendors table | Edit | Remove (ends the subscription in Finance) |
| Risk | "+ Risk": impact, likelihood, owner, mitigation, review date | Risk register (sorted by score) | Edit, status (open / mitigated / accepted) | Close |
| Service level | Defined here; Support reads them | Table | Edit (changes ticket targets) | — |

**Views and sub-pages**
- **`/ops`:** this week. Rhythm checklist, capacity, overdue SOPs.
- **`/ops/sops`**, **`/ops/vendors`**, **`/ops/risks`**, **`/ops/roles`:** each a standard list page.
- **`/ops/history`:** past weeks' completion rate per person.

**Metrics:**
- rhythm done this week;
- SOPs written / total;
- days deposit → live (capacity);
- open high risks;
- vendor cost per month.

**Automations**
- **Monday:** the week's rhythm items become tasks for their owners.
- **SOP past due:** "Needs a founder" (exists).
- **Risk review date reached:** task.
- **Vendor contract ending in 30 days:** task and a Build-or-buy check.

**Priority**
- **P0:** edit and clear SOP links; owner and due fields; add SOPs; show who ticked.
- **P1:** vendors, risks and roles as editable lists; rhythm items editable; history.
- **P2:** rhythm → tasks automation; vendor ↔ Finance link.
