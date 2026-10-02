# 22 — Scorecard (one person)
**Route:** `/team/{user_id}?weeks=4` · **Mockup:** `Scorecard.dc.html` · **Milestone:** M12 · **Roles:** the person themself + admins (same view); nobody else
**Top bar note:** "THE <ROLE> SEES THIS PAGE TOO"

## Layout
- **Title:** "<Name> · scorecard" + tenure ("Day 36 · since 26 Oct on calls").
- **Weekly KPIs table:**
  - columns: KPI · the last 4 weeks (older muted, the current week bright) · TARGET · STATUS chip (ON TRACK / WATCH);
  - KPIs per role from `context/03`. BDR: queue done (of capacity) · conversations per day · meetings booked · approved/booked · show rate · close rate on held · CRM updated same day · follow-up within 24 h.
- **CALL QUALITY · n CALLS SCORED THIS WEEK · m HUMAN-CHECKED:**
  - overall x / 100 (weighted: discovery counts double);
  - rubric bars: opener under 20 s · discovery · objection handling · clear next step · compliance (shown separately as a pass rate). Color by value (≥ 80 mint, 70–79 cyan, < 70 amber).
- **Right column:**
  - **1:1 AGENDA · AI DRAFT:** 01 strength · 02 practice focus with "two example calls attached" · 03 practical fix; a link "LISTEN TO THE 2 EXAMPLE CALLS ↗" → call review. Admins can edit the agenda before the 1:1.
  - **EARNINGS · <MONTH> · FIXED RULES:** base · approved meetings × $15 · closes (commission lines) · total. Read from `commissions` only.
  - **COMMENTS:** the person and admins can comment; the person can **dispute** a score (it marks the call review for a human re-check).

## Behaviour
- **Data window:** weeks are Monday–Sunday in the person's timezone.
- **Legal flag off:** hide the call-quality block and show results and discipline only.
- **Audit:** each view is logged (viewer, time).

## Endpoints
`GET /team/{user_id}` · `PATCH /team/{user_id}/agenda` · `POST /team/{user_id}/comments` · `POST /call-reviews/{id}/dispute`

## Acceptance criteria
- [ ] A person can't open another person's scorecard (403)
- [ ] Earnings equal the commission rows for the month and never use AI scores
- [ ] A dispute flags the review and notifies the co-founder
- [ ] It works at 390 px width
