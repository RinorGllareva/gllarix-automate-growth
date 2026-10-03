# Work › Tasks and projects (`/tasks/*`)

**Job:** everyone knows their next task; founders plan and balance the team's work.
**Who:** admin, bdr, closer, implementer (by space).

## Today (audit 2026-10-03)
This is the most complete module.
- **Views:** list (Notion style, grouped, saved views, bulk), board, timeline (Gantt with dependencies and capacity), workload, inbox, goals.
- **Task page:** subtasks, checklist, comments, attachments, dependencies, time, recurrence, AI split.
- **Import:** Notion import.
- **Trash:** delete to trash.

**Missing**
- **No trash view or restore:** the API exists, nothing calls it.
- **Can't remove a dependency:** the API exists, nothing calls it.
- **Spaces:** can't be created or renamed (no API).
- **Lists:** rename and archive only through an admin right-click and a browser prompt.
- **Task page:** the team, owner and due fields in the property row are display-only.
- **Checklist and time:** checklist text can't be edited; time entries can't be edited.
- **Board and Timeline:** no filters, search or saved views.
- **Workload:** no filters; fixed 5 weeks.
- **Inbox:** no filters; no "mark unread".
- **New-task form:** only title, list and due.
- **Goals:** can't be edited.
- **Export:** no task export.
- **Notion import:** running it twice creates duplicates.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Space | **"+ Space"** (name, icon, colour, who can see it: roles/people) | Space tabs | Rename, recolour, members, default views | Archive (founders) |
| List / project | "+ List" (exists); **from a project template** (e.g. "Gllarix setup", "3D project") | List chips; **project overview** (progress, dates, owner, budget hours vs logged) | Rename/archive **from a menu** (no prompt); status (active / on hold / done); owner; dates | Archive / restore |
| Task | Modal with **all fields** (owner, priority, estimate, start, tags, linked record); quick add with natural language ("Call Acme tomorrow 10am #sales @diego") | All views | Everything inline, **including the property row on the task page**; checklist text; time entries | Trash → **restore** / purge (founders) |
| Dependency | Exists | Exists | — | **Remove** |
| Goal | Exists | Goals view | **Edit** title, target, dates, linked tasks | Delete (exists) |

**Views and sub-pages**
- **All views:** the **shared ViewBar** (filter, sort, group, search, saved views) on List, Board, Timeline and Workload.
- **`/tasks/projects`:** every list as a project row: progress bar, owner, due, hours estimated vs logged, health (on track / late).
- **`/tasks/trash`:** deleted tasks with restore and "delete forever".
- **`/tasks/templates`:** project and task templates (also used by automations: "deal won → onboarding tasks").
- **Workload:** choose the date range and people; filter by space.
- **Inbox:** filters (mentions, assigned, due, comments); mark unread; snooze.

**Metrics** (the list summary exists; add a strip):
- my open tasks;
- overdue;
- due this week;
- hours planned vs capacity;
- blocked (waiting on someone).

**Automations:** recurring tasks (exist); task rules (exist on Growth › Automations); due-date reminders; when a task is blocked by another for over 3 days, the owner of the blocking task is notified.

**Integrations:**
- **GitHub:** issues ↔ tasks, PR status on the task.
- **Calendar:** time-blocks for tasks with a start time.
- **Export:** CSV export of any view.

**Priority**
- **P0:**
  - property row editable;
  - remove dependency;
  - trash view with restore;
  - list rename and archive menu;
  - full new-task form.
- **P1:**
  - ViewBar on board, timeline and workload;
  - spaces management;
  - projects overview;
  - templates;
  - export.
- **P2:** natural-language quick add; GitHub; Notion import de-duplication.
