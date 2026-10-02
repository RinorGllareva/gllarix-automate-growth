# 08 — Meetings and approval
**Route:** `/meetings` (week view; `?week=YYYY-Www`) · `/meetings/{id}` · **Mockup:** `Meetings.dc.html` · **Milestone:** M4 · **Roles:** admin (approve); BDR (own meetings, read-only approval); viewer (totals)

## Purpose
Track meetings, and approve the ones that count for the $15 bonus.

## Layout
- **Top bar:** "WEEK 49 · 30 NOV – 4 DEC" with week arrows; primary BOOKING LINK (copies the user's booking URL).
- **5 stat cards:**
  | Card | Shows |
  |---|---|
  | BOOKED | Count, "target 4+" |
  | HELD | Count, "n still to come" |
  | SHOW RATE | held ÷ meetings already due (target 70%+) |
  | APPROVED | Count, "n waiting" |
  | BONUS THIS WEEK | $15 × approved |
- **Table:** WHEN (lead-local and viewer time on hover) · COMPANY + sub-line (contact role, offer) · OWNER · STATUS chip · BONUS.
  - Statuses: UPCOMING (cyan), HELD, TO APPROVE (lavender, row highlighted), APPROVED (mint), REJECTED, NO-SHOW (muted).
  - The bonus column shows +$15, pending or —.
- **Approval panel (right, for the selected meeting):**
  - Title "APPROVE · <company>"; "Held <day> <time> · <duration> · recording available" (link).
  - **The 6 checks:** matches the target customer · contact details are valid · real business need · decision-maker attended · the meeting took place · not a duplicate or out of target.
  - Note: "Counts for the $15 bonus only if all are true."
  - APPROVE · $15 (enabled only when all 6 are ticked) and REJECT (requires a reason).
  - Note: "Rejections need a reason; the BDR sees it on his daily report."

## Behaviour
- **After the meeting:** the owner marks it **Held** / **No-show**. A no-show triggers the no-show follow-up (email where allowed + call task).
- **Approval** (admin only) sets `approved`, `approved_by`, `bonus_eligible`, and creates a pending `commissions` row (meeting_bonus).
- **Edits:** approval can be changed until the month is closed; after that it's locked.
- **Meeting detail** (`/meetings/{id}`): time, attendees, lead link, notes, recording, outcome (next step, deal created), approval history.

## Endpoints
- `GET /meetings`
- `GET /meetings/{id}`
- `PATCH /meetings/{id}` (held, no-show, notes)
- `POST /meetings/{id}/approve`
- `POST /meetings/{id}/reject`

## Acceptance criteria
- [ ] Approve is impossible unless all 6 checks are ticked
- [ ] The weekly bonus total equals $15 × approved
- [ ] The show rate uses only meetings already due
- [ ] Rejection reasons appear in the BDR's daily report
- [ ] A month lock prevents changes after the close
