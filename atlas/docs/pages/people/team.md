# People › Team performance (`/team`, `/team/:id`, `/team/calls/:id`)

**Job**
- **Founders:** coach each person every week from real calls and numbers.
- **Sellers:** see their own scorecard and dispute an unfair review.

**Who:**
- Founders: everyone.
- Sellers: themselves.
- Accountant: team totals only.

## Today (audit 2026-10-03)
- **Works:**
  - team overview;
  - scorecard (4-week KPI grid, call quality, earnings, comments);
  - call review (transcript, rubric);
  - AI scoring switch;
  - prepare 1:1s;
  - edit the 1:1 agenda;
  - comments;
  - human check;
  - dispute.
- **Missing:**
  - no week picker (the data layer already accepts a week);
  - comments can't be edited or deleted;
  - disputes have no "resolve" step of their own;
  - scorecard is capped at 30 calls;
  - demo player has no audio;
  - 1:1 notes and action items aren't stored as tasks.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| 1:1 meeting | "Prepare 1:1" (exists) → a 1:1 record per person per week | List of past 1:1s per person | Agenda, notes, agreed actions; each action becomes a task with an owner and a due date | Delete a draft |
| Call review | Automatic (AI, when it's on) or "Review this call" (human) | Review queue: unreviewed, disputed, flagged | Rubric scores, timestamped comments on the recording | — (kept for coaching history) |
| Dispute | "Dispute" by the person on the call (exists) | Disputes list for founders | **Resolve:** uphold or change the score, with a reason the person sees | Withdraw (by the disputer) |
| Comment | On a scorecard or a call (exists) | Thread | Edit your own within 15 min | Delete your own; founders delete any |

**Views and sub-pages**
- **`/team`:** the team this week. One row per person (DataTable) with:
  - dials, conversations, meetings, approved, show rate, call quality;
  - a trend arrow against last week;
  - a coloured status.
  - Week picker.
- **`/team/:id`:** person page with tabs **Scorecard**, **Calls**, **1:1s**, **Goals**, **Earnings**.
- **`/team/calls`:** call library. Filter by person, outcome, duration, score and objection. "Best calls" collection for training.
- **`/team/calls/:id`:** call review (exists) plus timestamped comments and "Add to training library".

**Metrics:** team dials, conversations and meetings vs target; average call-quality score; calls reviewed this week vs 3 per person; open disputes.

**Automations**
- Every Friday the 1:1s are prepared automatically, each with an agenda drawn from the AI performance tracker.
- If fewer than 3 calls per person were reviewed this week, a founder gets a task.
- A call scored over 90 is suggested for the training library.

**Rule:** AI scores coach. They never decide pay. A banner says so (exists); keep it.

**Priority**
- **P0:** week picker; resolve disputes; edit and delete comments.
- **P1:** 1:1 records with action items as tasks; call library with filters.
- **P2:** training library from calls; timestamped comments.
