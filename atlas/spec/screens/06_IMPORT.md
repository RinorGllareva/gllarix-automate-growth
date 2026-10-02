# 06 — Import leads (4 steps)
**Route:** `/leads/import` (`?step=1..4&job={id}`) · **Mockup:** `Import.dc.html` · **Milestone:** M1 · **Roles:** admin; co-founder (own lists)

## Purpose
Bring a CSV of leads in safely: clean it, catch duplicates, assign it, score it and queue it.

## Steps (a stepper bar: done steps muted with ✓, current step ice)
1. **Upload.**
   - Drag-drop or choose a CSV (≤ 20 MB, ≤ 50,000 rows), plus a source name (e.g. "Places API · Florida HVAC").
   - Parsed in a background job; shows "Parsed n rows in x s".
2. **Map columns.**
   - Each CSV column → an Atlas field (company name, phone, website/domain, email, contact name, role, city, state, country, industry, reviews count, rating, notes) or "ignore".
   - Auto-mapping by header name; mapping templates saved per source.
   - Required: company name + (phone or domain).
   - Preview of the first 10 rows after normalisation: phone in E.164, domain cleaned.
3. **Review duplicates.**
   - **Stat cards:** ROWS · NEW (mint) · EXACT DUPLICATES (exact phone or domain; skipped automatically, muted) · POSSIBLE DUPLICATES (amber; fuzzy name + city ≥ 90).
   - **Table of possible duplicates:** in this file (name + city/phone) · already in Atlas (name + city/domain) · match score · actions **Merge** (fill empty fields only, never overwrite) / **Keep both**.
   - Bulk actions: merge all ≥ 95, keep all.
4. **Assign and import.**
   - Fields: Owner · List (trades / developers) · Cadence · Source · Reason on record (lawful basis; default "Legitimate interest · B2B").
   - Checkbox "Score and add to tomorrow's queue".
   - Button "IMPORT n LEADS".
   - Note: "Opt-out list and country rules are checked before anything is queued."

## Behaviour
- **Compliance on import:**
  - Rows matching the opt-out list (phone, email or domain) are imported as suppressed or skipped (setting), with a count.
  - Rows from countries with no allowed channel get a warning.
- **Progress:** the import runs as a job with a progress bar; the user can leave the page; a notification fires when done.
- **Report:** imported, merged, skipped (with reasons), failed rows (downloadable CSV with an error column).
- **Undo:** "Undo import" within 24 h deletes the leads created by that job (if untouched).

## Endpoints
- `POST /imports` (upload)
- `GET /imports/{id}` (status)
- `PUT /imports/{id}/mapping`
- `GET /imports/{id}/duplicates`
- `POST /imports/{id}/duplicates/{row}/merge|keep`
- `POST /imports/{id}/run`
- `POST /imports/{id}/undo`

## Acceptance criteria
- [ ] 2,000 rows go from upload to report in < 30 s
- [ ] Exact duplicates never create a second lead
- [ ] Merge never overwrites existing values
- [ ] Opt-out matches are never queued
- [ ] Undo removes only that import's untouched leads
