# 17 — Task detail
**Route:** `/tasks/{id}` (full page; side panel from list or board) · **Mockup:** `TaskDetail.dc.html` · **Milestone:** M9 (core), M11 (AI), M13 (time) · **Roles:** anyone who can see the task's list

## Layout
### Main column
- **Chips:** status · category · priority.
- **Title:** 36 px weight 300, editable inline.
- **DESCRIPTION:** a Markdown editor (background, scope, out of scope, acceptance criteria). Template button: inserts those headings.
- **SUBTASKS · n OF m:**
  - rows with checkbox · title · owner · estimate; + add;
  - drag to reorder;
  - **SPLIT WITH AI ↗:** planner mode `split` → shows a draft of 2–8 subtasks; Accept adds them.
- **Checklist:** simple checkable items, separate from subtasks.
- **COMMENTS:**
  - avatar, name, time, text; @mentions notify;
  - edit or delete your own comment;
  - attachments by drag-drop.
- **Activity log:** collapsed; every field change with who and when.

### Right column
| Card | Content |
|---|---|
| Fields | Owner(s) · Start · Due · Estimate · List · Linked (lead, deal, client or meeting, with a link) · Tags · Created by (person, or "AI planner · accepted by …") |
| TIME | used / estimate with a bar · START TIMER (shows the running time) · "+ Add time" (manual entry) · entries list |
| BLOCKS / WAITING ON | Dependencies with status; + add (search tasks); a warning if waiting on an unfinished task |
| AI PLANNER note | Capacity fit ("Rinor has 12 h this weekend; this task needs 6 h more…") and risks, from the scheduler and planner; refreshes when dates or owners change |
| GitHub (for Codex tasks) | Linked PR, status (open, review, merged) and CI result |

## Behaviour
- **Saving:** every field saves on change (optimistic UI, with a revert on error).
- **Status Done:** blocked if open subtasks exist (confirm "complete subtasks too?").
- **Recurring tasks:** a recurrence rule (weekly, monthly, custom); completing one creates the next.
- **Delete:** moves to trash for 30 days (admin can restore).

## Endpoints
- `GET /tasks/{id}` · `PATCH /tasks/{id}`
- `POST /tasks/{id}/subtasks` · `POST /tasks/{id}/comments` · `POST /tasks/{id}/dependencies`
- `POST /tasks/{id}/split` (AI draft) · `POST /plans/{plan_id}/accept`
- `POST /timer/start` · `POST /time-entries`

## Acceptance criteria
- [ ] Every field edit persists and appears in the activity log
- [ ] @mention creates a notification
- [ ] AI split creates nothing until Accept
- [ ] The timer survives page changes (one running timer per user)
- [ ] A dependency cycle is rejected
