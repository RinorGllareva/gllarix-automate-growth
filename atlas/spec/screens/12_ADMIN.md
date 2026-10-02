# 12 — Admin (shell + 10 sections)
**Route:** `/admin` → redirects to `/admin/country-rules` · `/admin/{section}` · **Mockup:** `Admin.dc.html` · **Milestone:** M0–M2 · **Roles:** admin only (everyone else 403)

## Layout
- **Three columns:**
  - left: section nav (220 px);
  - center: the section content;
  - right (330 px): a system panel shown on every section.
- **Section nav** (40 px rows; the active one ice; a count on the right). Each section has its own spec file:
  | Section | File |
  |---|---|
  | Users and roles | `admin/01_USERS_AND_ROLES.md` |
  | Settings | `admin/02_SETTINGS.md` |
  | Country rules | `admin/03_COUNTRY_RULES.md` |
  | Scoring models | `admin/04_SCORING_MODELS.md` |
  | Cadences | `admin/05_CADENCES.md` |
  | Price book | `admin/06_PRICE_BOOK.md` |
  | Opt-out list | `admin/07_OPT_OUT_LIST.md` |
  | Background jobs | `admin/08_BACKGROUND_JOBS.md` |
  | Integrations | `admin/09_INTEGRATIONS.md` |
  | Audit log | `admin/10_AUDIT_LOG.md` |
- **System panel (right):**
  - **BACKGROUND JOBS:** the last 5 runs, each with a status dot and detail ("Queue build · BDR — 05:00 VET · 150 items in 3.8 s").
  - **PAID API CAPS · <MONTH>:** Places API, email verification, AI drafts and summaries; used / cap and a bar (coral at 100%).
  - **OPT-OUT LIST:** count + the last entry.

## Rules
- Top bar primary: SAVE CHANGES (when the section has unsaved edits; otherwise hidden).
- Every change in admin writes `audit_log` with before/after.
- A banner on every admin page when any market is unverified or any cost cap is reached.
