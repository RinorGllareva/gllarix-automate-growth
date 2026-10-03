# Work › AI planner (`/tasks/planner`)

**Job:** turn an idea or meeting notes into a costed, scheduled task plan in minutes, then accept it into Tasks.
**Who:** founders and sellers. The implementer is blocked today although they can open Tasks; decide whether they should plan too.

## Today (audit 2026-10-03)
- **Tabs:**
  - plan an idea;
  - tasks from notes;
  - this week's picks (read-only);
  - log.
- **Draft plan:**
  - summary cards: tasks, hours, freelancer hours, finish date;
  - editable rows;
  - flags and open questions;
  - accept or reject;
  - AI spend against the monthly cap.
- **Missing:**
  - the idea and notes boxes are pre-filled with example text;
  - the deadline is hard-coded (31 Oct 2026);
  - a row's dependencies, priority and category can't be edited;
  - weekly picks can't be applied;
  - log links for non-plan modes go nowhere;
  - no search in the log;
  - demo mode uses a fake AI.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Plan draft | From an idea, notes, a **meeting** (its notes), a **deal** (won → delivery plan), or a **doc** | Draft view (exists) | Every row field incl. **dependencies, priority, category, start date**; drag to reorder; re-ask the AI about one row ("split this", "cheaper option") | Discard (exists) |
| Accepted plan | Accept → creates a list or project with tasks (exists) | Log, linked to the project | Re-plan: compare the plan with progress and propose changes | — |
| Weekly picks | AI suggests on Monday | List | **Apply** (assign and schedule), dismiss one | — |

**Views and sub-pages**
- **`/tasks/planner`:** an empty input with suggestions ("Plan the next client setup", "Plan the hiring of setter #1"). No pre-filled text.
- **`/tasks/planner/:id`:** draft or accepted plan, with a "vs reality" view once it's running.
- **Log:** search, filter by mode and person, working links.

**Rules:**
- the AI cost is shown before running;
- the monthly cap is enforced;
- prompts and keys stay server-side.

**Priority**
- **P0:** empty inputs; deadline picker; edit dependencies, priority and category.
- **P1:** plan from a meeting, deal or doc; apply weekly picks; log links and search.
- **P2:** re-plan against reality.
