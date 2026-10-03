# People › Training (`/training`)

**Job**
- **Founders:** run each new hire's 10-day program with a gate per block.
- **Trainee:** know what's next and what "passed" means.

**Who:**
- Founders: edit.
- Trainee: their own program.

## Today (audit 2026-10-03)
- **Works:**
  - start a program;
  - 6 blocks with gates (roleplay scores, quiz, first approved meeting);
  - "Ready before day 1" checklist;
  - weekly routine;
  - objections heard in the last 30 days.
- **Missing:**
  - can't cancel or delete a program;
  - can't edit the trainee's name, role or start date;
  - wrong scores can't be removed;
  - gate notes can't be written (the API supports them);
  - the curriculum and the objection library are in code;
  - no learning materials attached to blocks.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Program | Start (exists), from a hire or a user | Trainee list with day x/10 and gates passed | Edit name, role, start date; pause; extend by N days | Cancel with a reason (kept in history); delete if never started |
| Block / gate | From a **curriculum template** (editable): title, days, gate type (score ≥ N, quiz, evidence), materials | Program timeline | Add score; remove a wrong score; pass or reopen the gate with a **note** | — |
| Curriculum template | "New template" (BDR, implementer, setter) | Templates list | Edit blocks, materials (docs, recorded calls, videos), quiz questions | Archive |
| Objection answer | From the objections heard: "Write the answer" | Objection library with "heard N times", "answered", "approved by" | Edit; approve (founder) → appears in the call workspace | Retire |

**Views and sub-pages**
- **`/training`:** trainees (exists).
- **`/training/library`:** materials (docs from the wiki, best calls from Team, scripts).
- **`/training/objections`:** the objection library, editable here. Today it lives in `config/scripts.ts`.
- **`/training/templates`:** curriculum editor.
- **Trainee view:** "Today in training": the block, what to read or watch, and what the gate needs.

**Metrics:** trainees on schedule; average days to certified; gate first-pass rate; days to first approved meeting.

**Automations**
- Day N of a program: the trainee gets the day's tasks.
- Gate passed: a founder is told and the next block unlocks.
- Day 30: a trial review task for the founders (exists in the routine).

**Priority**
- **P0:** edit and cancel programs; remove scores; gate notes.
- **P1:** objection library editable in Atlas (it feeds the call workspace); materials per block.
- **P2:** curriculum templates; trainee "today" view.
