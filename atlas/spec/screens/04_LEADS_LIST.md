# 04 — Leads list
**Route:** `/leads` · **Mockup:** `Leads.dc.html` · **Milestone:** M1 · **Roles:** admin (all leads), BDR (assigned + own lists), viewer (read-only counts)

## Purpose
Find, filter and act on leads in bulk.

## Layout
- **Top bar:** context "4,812 LEADS · 1,204 TIER A/B"; primary IMPORT CSV → `/leads/import`.
- **Title row:** "Leads" + bulk buttons ASSIGN · ADD TO CADENCE · RESCORE. Enabled when rows are selected; hidden for the BDR except ADD TO CADENCE on own leads.
- **Filter chips:**
  - TIER (A–D; default A, B), LIST (trades / developers), COUNTRY, STAGE (open stages by default), OWNER, SOURCE, BRAND, + Filter for any field;
  - active chips have an ice background;
  - filters live in the URL query, so views can be shared.
- **Table columns:**
  | Column | Content |
  |---|---|
  | (checkbox) | Select |
  | SCORE | Tier badge "A 81" |
  | COMPANY | Links to `/leads/{id}` |
  | INDUSTRY | |
  | LOCATION | City · country |
  | LOCAL | Local time, mono |
  | STAGE | Chip |
  | OWNER | |
  | NEXT ACTION | |
  | LAST | Time since the last touch |
- **Footer:** "Showing 50 of n · sorted by score, then local time" + cursor pagination.

## Behaviour
- **Sorting:** default by score desc, then local time; click headers to sort by score, company, stage, owner, last touch or next action date.
- **Select:** shift-click selects ranges; "select all n matching" selects across pages, with the count shown.
- **Bulk actions (admin):**
  - **Assign** owner and list.
  - **Add to cadence** (choose a cadence; skips leads that fail compliance, showing the count skipped and why).
  - **Rescore** (queued job).
  - **Export CSV** (admin only, logged).
- **Saved filters** per user.
- **Quick search** filters by company, phone or domain.

## Data
- Source: `leads` joined with `companies`, `contacts` (primary) and `users` (owner).
- Indexes on tier, stage, owner, country and next_action_at.

## Endpoints
- `GET /leads` (query: filters, sort, cursor)
- `POST /leads/bulk/assign`
- `POST /leads/bulk/cadence`
- `POST /leads/bulk/rescore`
- `GET /leads/export.csv`

## States
- **No leads:** "No leads yet. Import a CSV or run a list build." + IMPORT CSV.
- **No match:** "No leads match these filters." + clear filters.

## Acceptance criteria
- [ ] 20,000 seeded leads: the first page loads in < 500 ms
- [ ] Filters combine (AND) and survive a reload via the URL
- [ ] The BDR never sees leads he doesn't own
- [ ] Bulk add-to-cadence reports skipped leads with their reasons
- [ ] Every export is written to `audit_log`
