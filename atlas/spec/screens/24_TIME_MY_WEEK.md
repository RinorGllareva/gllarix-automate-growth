# 24 — Time tracking: my week
**Route:** `/time?week=` · **Mockup:** `Time.dc.html` · **Milestone:** M13 · **Roles:** everyone (own time); admins can switch person

## Layout
- **Top bar:** "MY TIME · <NAME> · WEEK nn"; primary TEAM REPORTS (admin) → `/time/reports`.
- **Running timer card** (cyan border, when running): status dot · task name · space/list label · elapsed time (mono 26 px) · STOP (coral) · SWITCH TASK. When idle: START TIMER with a task picker.
- **Timesheet grid:**
  - rows = task, client or project with the category label (colored);
  - columns MON–SUN (cells 50 px, editable hours, "—" when empty) + TOTAL;
  - footer DAY TOTAL row and the week total (mint);
  - "+ Add row or manual entry" (pick a task, client or project; category; billable flag; note).
- **Right column:**
  - **THIS WEEK:** total / capacity hours + bars per category against the target split (e.g. Sales 20 / 22, Operations and management 8 / 8, Development 1 / 5).
  - **ESTIMATES VS ACTUAL:** tasks finished · estimated · actual (ratio, amber if over 1.2×) + "The AI planner uses this ratio for your future estimates".
  - **SUBMIT WEEK** (primary) + the note "You enter your own time. No activity, screen or idle tracking."

## Behaviour
- **One running timer per user.** Starting a new one stops the old one.
- **Timer limits:** a timer running more than 10 h asks for confirmation on the next page load.
- **Cell edits:** typing in a cell creates or adjusts a manual entry for that day (rounded to 0.25 h).
- **Submit:** locks the week for the user (status submitted). An admin approves (locked) or reopens with a comment.
- **Billable rows:** show the rate. Approved billable time becomes Stripe invoice items (M7 hook).

## Endpoints
- `GET /time`
- `POST /timer/start` · `POST /timer/stop`
- `PUT /time-entries/cell` (row, day, hours)
- `POST /time-entries`
- `POST /timesheets/{id}/submit` · `POST /timesheets/{id}/approve|reopen`

## Acceptance criteria
- [ ] Row, day and week totals add up exactly
- [ ] Submitted weeks can't be edited by the user
- [ ] Timer state survives page changes and browser restarts
- [ ] No code anywhere tracks idle time, screens or apps
