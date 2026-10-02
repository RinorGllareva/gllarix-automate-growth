# 15 — Tasks: list view (+ My work and Inbox)
**Route:** `/tasks?space=&list=` · `/tasks/my-work` · `/tasks/inbox` · **Mockup:** `Tasks.dc.html` · **Milestone:** M9 · **Roles:** admin (all spaces); BDR (Sales and Lead gen spaces + tasks assigned to him); implementer (Delivery + assigned)

## Layout
- **Top bar:** context "COMPANY / <LIST> · WEEK nn"; primary PLAN WITH AI → `/planner`.
- **Spaces panel (220 px)** (component `TaskSpaces.dc.html`):
  - **My work:** count of open tasks assigned to me.
  - **Inbox:** unread mentions, assignments and comments on my tasks.
  - **SPACES:** Company, Sales, Lead gen, Delivery, Development, Finance, Operations, Research, each with a color square and count, expanding to its lists. The active list is ice.
  - **PLAN WITH AI** button at the bottom.
  - Right-click a space or list → rename, new list, archive.
- **View tabs (64 px)** (component `ViewTabs.dc.html`): List · Board · Timeline · Workload · AI planner. Right side: Group: status ▾ · Filter · + TASK.
- **Content:**
  - Title (list name) + a summary line ("11 open · 29.5 h estimated · most due before …").
  - Column header: (status box) · TASK · OWNER · DUE · PRIORITY · EST. · CATEGORY.
  - **Groups** (collapsible; default by status: IN PROGRESS, TO DO, REVIEW, then DONE and CANCELLED collapsed). Each group header has a color square, name and count.
  - **Row (44 px):** status box (click cycles status) · title + subtask progress "2/6" + AI tag if `created_by_ai` · owner(s) · due (coral if overdue) · priority (Urgent/High coral, Normal amber, Low muted) · estimate · category chip.
  - Click a row → task detail (`/tasks/{id}`; opens as a side panel on wide screens).

## Behaviour
- **Inline add:** "+ Add task" at the end of each group (title, then Enter; defaults: this list, this status, me).
- **Inline edit:** owner, due, priority, estimate and category via dropdowns.
- **Group by:** status · owner · priority · category · due week · none.
- **Sort:** due · priority · created · manual (drag handle).
- **Filter:** owner, priority, category, due range, tags, created by AI, has dependencies.
- **Bulk select:** set status, owner, due or priority; move to a list; delete (to trash).
- **Saved views** per user and list.
- **My work:** every task assigned to me across spaces, grouped by Overdue · Today · This week · Later · No date.
- **Inbox:** mentions, assignments and comments, newest first; mark read; open.

## Endpoints
- `GET /tasks`
- `GET /partials/tasks/list`
- `POST /tasks`
- `PATCH /tasks/{id}`
- `POST /tasks/bulk`
- `GET /tasks/my-work`
- `GET /tasks/inbox`
- `POST /lists`, `PATCH /lists/{id}`

## Keyboard
`T` new task · `J/K` move down/up · `Enter` open · `X` select · `S` status · `A` assign · `D` due

## Acceptance criteria
- [ ] Groups, counts and the summary hours are correct
- [ ] Inline edits persist and write the activity log
- [ ] The BDR sees only his allowed spaces
- [ ] My work shows every assigned task across spaces
- [ ] The Notion CSV import (one time) lands in the right lists with owners, dates, priorities and categories
