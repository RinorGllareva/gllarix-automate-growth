# 16 — Tasks: board view
**Route:** `/tasks/board?space=&list=` · **Mockup:** `TaskBoard.dc.html` · **Milestone:** M9 · **Roles:** as the list view

## Layout
- Same shell, spaces panel and view tabs (Board active).
- **Columns, one per list status:** TO DO, IN PROGRESS, REVIEW, DONE · THIS WEEK (+ Blocked when used). Each header shows a color square, name and total estimated hours (or a count for Done).
- **Card:** category chip + priority · title · progress bar (subtasks done or time used ÷ estimate) · owner · due · estimate.
- "+ Add task" at the bottom of each column.

## Behaviour
- **Drag between columns:** changes the status. Moving to Done sets `completed_at` and asks for logged time if none exists (optional, skippable).
- **Drag within a column:** reorders (stored `position`).
- **Done column:** shows only this week; a link for older ones.
- **WIP warning:** an amber column header when In progress has more than 3 tasks per person (setting).
- **Swimlanes:** optional, by owner.

## Endpoints
`GET /tasks/board` · `PATCH /tasks/{id}` (status, position)

## Acceptance criteria
- [ ] Drag-and-drop persists across reloads
- [ ] Column hour totals equal the sum of the card estimates
- [ ] Keyboard alternative: focus a card, then `Shift` + ←/→ moves it
