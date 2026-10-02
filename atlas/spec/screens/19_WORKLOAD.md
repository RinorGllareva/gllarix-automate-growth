# 19 — Workload and availability
**Route:** `/tasks/workload?from=` · **Mockup:** `Workload.dc.html` · **Milestone:** M10 · **Roles:** admin; others see only themselves

## Layout
- Same shell; view tabs (Workload active).
- **Workload grid:**
  - rows = people (name + capacity line, e.g. "Weekends · 12 h", "Ops + dev · 13 h", "Sales · 40 h", "Codex agent · needs founder review");
  - columns = 5 weeks;
  - each cell is a 56 px box with "used / cap h" and a bar (mint < 90%, amber 90–100%, coral > 100%, with a coral border);
  - Codex agent cells show "n PR · x h rev".
  - Clicking a cell lists the tasks scheduled there.
- **AI SUGGESTIONS · WEEK nn:** one per line, with a one-click button:
  - MOVE ("Rinor is 2 h over in W41. Move 'Measure cost per minute' to W42, where he has 3 h free");
  - REASSIGN ("The Atlas M1 review can go to the co-founder…");
  - SCHEDULE ("'Confirm country rules' has no hours booked yet; block 1 h on Mon 5 Oct").
- **AVAILABILITY panel (right):**
  - per person: hours per week, windows ("Sat and Sun · 09:00–15:00 CET"), category split ("Development 70% · review 20% · management 10%");
  - **EDIT HOURS AND TIME OFF** opens an editor: windows per weekday in the person's timezone; category split (must sum to 100%); time off (date ranges); focus factor (admin).

## Behaviour
- **Capacity:** window hours × focus factor (0.8) − scheduled hours, from `availability` and `time_off`.
- **Suggestions:** from the nightly re-plan (planner mode `replan`) and from the scheduler's conflict list. Applying one updates the task and recalculates the grid. Dismissing hides it for that week.
- **Estimate accuracy:** after 4 weeks of time data, show each person's actual ÷ estimate ratio; the planner uses it instead of the default buffer.

## Endpoints
- `GET /tasks/workload`
- `GET /partials/workload/cell?user=&week=`
- `POST /suggestions/{id}/apply`, `POST /suggestions/{id}/dismiss`
- `PUT /availability/{user_id}`
- `POST /time-off`

## Acceptance criteria
- [ ] Capacity math matches the scheduler unit tests
- [ ] Applying a MOVE suggestion changes the task dates and both weeks' cells
- [ ] A category split that doesn't sum to 100% is rejected
- [ ] People without admin rights can edit only their own availability
