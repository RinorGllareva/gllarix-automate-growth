# 20 — AI planner
**Route:** `/planner` · `/planner/{plan_id}` · **Mockup:** `Planner.dc.html` · **Milestone:** M11 · **Roles:** admin; others can plan only for themselves

## Purpose
Turn an idea into scheduled tasks that fit real hours. Nothing is saved until Accept.

## Layout
- **Top bar:** context "AI PLANNER · DRAFT, NOTHING SAVED YET"; primary BACK TO TASKS.
- **YOUR IDEA:** a textarea, e.g. "Launch a 3D showcase … Done by 31 Oct".
- **SETTINGS (right):** deadline (date) · estimate buffer (+30% default, or each person's real ratio) · people allowed (multi-select) · context used (price book, sales plan, calendar; toggles) · target list · REGENERATE PLAN.
- **Summary cards:** TASKS · TEAM HOURS · FREELANCER (or external hours) · FINISHES (date, with ✓ if before the deadline, or coral "after deadline").
- **Proposed tasks table:**
  - columns: # · TASK · OWNER (colored) · EST. · SCHEDULED (date or range from the scheduler) · AFTER (dependencies);
  - expand a row to see the description, acceptance checks, confidence and subtasks;
  - inline edits: owner, estimate, title, remove row, add row.
- **WHAT THE PLANNER CHANGED OR FLAGGED:** an amber box with conflicts and risks, e.g. "Rinor is full on 3–4 Oct… moved to 10–11 Oct", "UAE outreach rules aren't verified yet…", "Freelancer cost isn't in the budget yet: add a quote, [€ amount]".
- **Buttons:** ACCEPT n TASKS (primary) · EDIT BEFORE SAVING.

## Behaviour
1. **Plan:** builds the request (idea, settings, 8-week capacity snapshot, open tasks, context extracts) → `AIProvider` with `prompts/TASK_PLANNER_SYSTEM_PROMPT.md` and the Appendix 5 schema.
2. **Validate:** with pydantic; retry once on invalid JSON; reject unknown owners and estimates outside the 0.5–40 h range.
3. **Schedule:** `services/scheduler.py` attaches dates and conflicts. Every edit re-runs the scheduler (not the AI).
4. **Accept:** creates the tasks (`created_by_ai=true`, `plan_id`), dependencies, subtasks and review subtasks for Codex tasks, in the chosen list; notifies the owners; the plan status becomes accepted.
5. **Other modes from here:**
   - **Weekly:** "What should we do this week/weekend?" returns a pick list that fits free hours.
   - **Tasks from notes:** paste notes; the source is linked.
6. **Cost:** each run is logged in `plans` with model and cost; blocked when the monthly AI cap is reached (message + admin notification).

## Endpoints
- `POST /planner/plan` (returns `plan_id` + the draft partial)
- `PATCH /planner/{plan_id}/rows/{key}`
- `POST /planner/{plan_id}/reschedule`
- `POST /planner/{plan_id}/accept`
- `POST /planner/weekly`
- `POST /planner/from-notes`

## Acceptance criteria
- [ ] With the fake provider, the 3D showcase idea gives 9 tasks, 20 team hours, a finish before 31 Oct, and the 3 flags above
- [ ] Nothing is written to `tasks` before Accept
- [ ] Editing an estimate updates the dates and the finish card without calling the AI
- [ ] Tasks for Codex get a review subtask for Rinor or the co-founder
- [ ] The cost cap blocks new plans
