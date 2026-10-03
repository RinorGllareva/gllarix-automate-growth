# The Atlas page standard

Every page in Atlas follows the same structure. This document comes first; each page spec in this folder lists only its differences.

**Why this exists**
- Today each page was built on its own: Leads has a filter row, Deals groups by stage, Finance stacks cards, Hiring is a board.
- People relearn every page, and every new feature means designing a new layout.
- With one standard, a new page is mostly configuration:
  - which entity it shows;
  - which fields;
  - which views;
  - which actions.

**Who it's for**
- Founders (Rinor and the co-founder).
- BDR / closer (Diego).
- Implementer (Lena).
- Accountant (viewer).

---

## 1. Page anatomy (the same slots on every page)

```
┌ Top bar ── breadcrumb · page context · [primary action] ─────────────┐
├ Page job (one line: why you're here · done when…) ── Hide tips ──────┤
├ Header ── Title · short description · [secondary actions ▾] ─────────┤
├ Metrics strip ── 3–5 KPI tiles, each clickable → filters the view ───┤
├ View bar ── [Saved views ▾] [List|Board|Calendar|…] · Filter · Sort ·  │
│            Group · Columns · Search · (count + selection actions)     │
├ Body ── the view (DataTable / Board / Calendar / Timeline)            │
│         + optional right panel (preview of the selected record)      │
└───────────────────────────────────────────────────────────────────────┘
```

**Rules**
- **Header:** one primary action per page, top right, always the same place, e.g. "+ New lead" or "Log expense".
  - Everything else goes in a "More ▾" menu: import, export, settings for this page.
- **Metrics:** at most 5 tiles.
  - Each tile shows a number, a comparison (vs target or last period) and a status colour.
  - Clicking a tile applies its filter to the view below ("Late invoices: 3" → the table shows those 3).
  - Tiles never show data that has nothing to act on.
- **View bar:** one component (`<ViewBar>`) for every list page. Saved views are per page and per person, with "Share with team" for founders.
- **Body:**
  - every list is the shared `DataTable`;
  - every board is the shared `Board`;
  - every calendar is the shared `CalendarView`;
  - no hand-built grids.
- **Empty states:** say what to do next and offer that button. Never "No data".
- **Loading:** skeleton rows in the same shape as the result. **Errors:** an inline message with Retry.

## 2. Records: one detail layout for everything

Every entity (lead, deal, client, meeting, task, ticket, candidate, expense, doc, …) opens in the same record layout:

```
┌ Breadcrumb · record title · status chip · [primary action] [⋯ More] ┐
├ Property row (Notion style): owner · stage · dates · amounts · tags   │
├ Tabs: Overview · Activity · Related · Files · (entity-specific)       │
│   left: content            right: "Next step" card + key facts        │
└───────────────────────────────────────────────────────────────────────┘
```

**Rules**
- **Edit in place:** click a property to change it. "Edit" modals are only for many fields at once (e.g. a contact).
- **Activity:** every record has the same timeline (calls, emails, notes, stage changes, file uploads, automation runs). Filterable, with "Add note" always at the top.
- **Related:** linked records as small lists with "+ link / + create" (lead ↔ deal ↔ client ↔ meetings ↔ tasks ↔ tickets ↔ files).
- **Next step card:** the one thing to do on this record now, computed by the same rules as Today (e.g. "Quote opened 3 d ago: call and ask for the deposit").
- **Open from anywhere:** a record opens as a full page (`/x/:id`), and from a list as a side panel (`?open=:id`). Same component in both.

## 3. CRUD contract (every entity, no exceptions)

| Operation | UI | Rules |
|---|---|---|
| **Create** | Primary button + `C` hotkey + Ctrl K "New …" + inline "+ New" row in lists | Required fields only; the rest after creation. Duplicates detected before saving (match on email, phone, domain, name). |
| **Read** | List, board, calendar, record page, Ctrl K | Same filters everywhere: owner, status, date range, tags, free text. |
| **Update** | Inline edit, bulk edit on selection, keyboard (S = status, A = assign to me) | Every change writes the activity log and the audit log (who, when, before → after). |
| **Delete** | ⋯ → Delete, or bulk Delete | Soft delete to Trash for 30 days, with an "Undo" toast for 10 s. Hard delete is founders only, from Trash. Records tied to money (paid invoices, signed contracts, payouts) can't be deleted, only voided with a reason. |
| **Bulk** | Select rows (click, Shift-click, select all matching) | Assign, change status, tag, add to cadence, export, delete. |
| **Import / Export** | ⋯ More → Import CSV / Export CSV | Column mapping with saved templates, dry-run preview, undo of a whole import. Exports are logged. |

## 4. Permissions (decided on the server, mirrored in the UI)
- **Hidden** if a role has no job on the page (`config/pageJobs.ts`, enforced by a test).
- **Read-only** when a role may see but not change. The controls are shown disabled with a tooltip ("Founders edit prices").
- **Row-level:**
  - sellers see their own leads, deals and meetings;
  - the implementer sees clients and tickets;
  - the accountant sees money but no personal call data.
- In Supabase mode the same rules are RLS policies; the UI never decides on its own.

## 5. Interaction standards

**Keyboard**
- `Ctrl K` searches everything.
- `G` then a key jumps to a page.
- `C` creates, `/` focuses search, `J`/`K` move, `Enter` opens, `X` selects, `E` edits, `Esc` closes.
- `?` shows the shortcuts for the current page.

**Feedback and accessibility**
- Toasts confirm what changed, with Undo where it's possible.
- Optimistic updates, rolled back with an error toast if the save fails.
- Timezones: times show in the record's local zone with your zone on hover, consistently.
- Numbers use tabular figures. Money always shows its currency and never adds USD and EUR together; totals are converted at the planning rate, and the page says so.
- Phones: every page either works at 375 px (bottom tab bar) or says it needs a larger screen. Lists become cards; boards become lists.
- Accessibility:
  - 4.5:1 contrast;
  - a visible focus ring;
  - names on every control;
  - tables with table semantics;
  - no information carried by colour alone.

## 6. Components to standardise (build once, use everywhere)

| Component | Status | Used by |
|---|---|---|
| `DataTable` | Done | Leads, Deals, Tasks, Time reports → extend to every list |
| `ViewBar` (saved views, filters, sort, group, columns, search) | Built (`components/ViewBar.tsx`); on Deals, Support, Payments, Finance, Commissions | Every list |
| `RecordPage` + `PropertyRow` + `ActivityTimeline` + `RelatedList` | Built (`components/record/Record.tsx`); used by every record: lead, deal, client, meeting, ticket, candidate, doc | Lead, deal, client, meeting, ticket, candidate, doc |
| `MetricTile` (value, comparison, status, click-to-filter) | Partly (`KpiCard`) | Every page header |
| `Board` (drag between columns, WIP limits, swimlanes) | Two versions today (Pipeline, Tasks) → merge | Pipeline, Tasks, Hiring, Support |
| `RecordFiles` | Done | Leads, deals, clients → add tickets, candidates |
| `FormBuilder` (fields from a schema, validation, custom fields) | To build | Every create/edit form, custom fields |
| `ImportWizard` (map → preview → import → undo) | Leads only → generalise | Leads, contacts, deals, tasks, expenses, clients |
| `CommentThread` with @mentions | Tasks only → generalise | Every record |
| `Trash` (restore, purge) | To build | Settings › Trash |

## 7. Custom fields and future features
- **Custom fields:** every entity gets `custom: Record<string, value>`, defined in Settings › Fields (types: text, number, money, date, select, multi-select, person, link, checkbox). They show up automatically in the property row, the table's column picker, filters, import mapping and exports.
- **A new module is configuration:** an entity definition (fields, statuses, permissions), plus its views, plus its page job. The shell, tables, record page, search, activity, files, import/export and automations then come for free. This keeps future features consistent.
- **Events:** every create, update or delete emits an event (`lead.created`, `deal.stage_changed`, `invoice.paid`, …). Automations, notifications, webhooks and the AI co-founder all listen to the same stream (see 01-INTEGRATIONS).
