# 18 — Timeline (Gantt) with capacity
**Route:** `/tasks/timeline?space=&list=&from=&to=` · **Mockup:** `Timeline.dc.html` · **Milestone:** M10 · **Roles:** admin; others see their own spaces

## Layout
- Same shell; view tabs (Timeline active).
- **Header row:** TASK column (220 px) + week columns ("W40 · 28 SEP" …), 5 weeks by default. Zoom: day / week / month.
- **Task rows (36 px):** title (ellipsis) + a bar from start to due, colored by owner (border + 20% fill). Dependencies are drawn as thin lines between bars.
- **Milestones:** diamonds with a label (e.g. "Milestone · BDR starts calling · 26 OCT").
- **CAPACITY USED · HOURS PER WEEK:** one row per person ("Rinor · 12 h / wk", "Co-founder · 13 h ops+dev", "BDR · 40 h sales"). Cells show "used / capacity", colored: normal; amber ≥ 90%; coral > 100%.
- **Legend:** the owner colors.

## Behaviour
- **Edit by dragging:** drag a bar to move its dates; drag its edges to change start or due. Dependents shift if "auto-schedule dependents" is on (asks first).
- **Capacity:** from `services/scheduler.py`, recomputed after each change.
- **Overload:** clicking an overloaded cell opens the Workload suggestions for that week.
- **Unscheduled tasks:** shown in a side tray; drag them onto the timeline.

## Endpoints
`GET /tasks/timeline` · `PATCH /tasks/{id}` (start, due) · `GET /partials/capacity?from=&to=`

## Acceptance criteria
- [ ] Bars match the start and due dates exactly
- [ ] Moving a bar updates the capacity cells
- [ ] The seeded Q4 launch list shows Rinor at 14 / 12 h in W41 (coral)
- [ ] Dependency lines render, and a move that breaks a dependency is warned about
