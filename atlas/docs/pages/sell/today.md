# Sell › Today (`/today`)

**Job**
- **BDR / closer:** start the shift knowing exactly what to do, in order (queue, inbound, callbacks, deals to move, money earned).
- **Founders:** see the team's day and everything waiting for a decision.

**Who:** admin, bdr, closer.

## Today (audit 2026-10-03)
- **Works:**
  - queue progress and pace;
  - 4 KPI cards;
  - "Up next" (first 8 rows);
  - Needs attention;
  - queue mix;
  - Inbound waiting, Deals to move, Your money (sellers);
  - Needs a founder (admins: pulls from about 10 modules);
  - rebuild queue;
  - top-up list build.
- **Missing:**
  - today only: no history and no date picker;
  - targets in the KPI cards are hard-coded text;
  - "Up next" capped at 8;
  - the empty state says "Build tomorrow's list" without a button;
  - no way to act on a "Needs a founder" line without leaving the page;
  - no personal to-do or task list.

## Must-have functionality

**Daily plan (one per person per day)**
- **Create:** built automatically at shift start.
- **Read:** queue, callbacks, inbound, meetings today, tasks due today.
- **Update:**
  - re-order by drag;
  - snooze an item ("later today" or "tomorrow");
  - mark done inline;
  - rebuild the queue.
- **Delete:** remove from today (it returns tomorrow).

**Founder decision**
- **Create:** gathered automatically from every module.
- **Read:** one inbox of decisions.
- **Update:** act inline: approve the meeting, agree the spend, assign the inbound, send the reminder. Or snooze with a reason.
- **Delete:** dismiss (it comes back if still true tomorrow).

**Views and sub-pages**
- **`/today` for sellers:**
  - **"My day" timeline** (morning to evening): calling blocks from the queue windows, meetings, callbacks at their time, tasks with due times.
  - **Right rail:** inbound waiting, deals to move, my money.
- **`/today` for founders:** the team strip (who's dialling, behind pace, on a call) and the **Decisions inbox**. Each decision has its action buttons inline, so 80% are done without leaving Today.
- **`/today/history`:** any past day's numbers and what was done (date picker). Sellers see their own; founders see everyone.
- **End-of-day summary:** the "Daily BDR report", shown at shift end with a "Send to founders" button.

**Metrics:** dials, conversations, meetings and approved vs **targets read from People › KPIs** (not hard-coded); pace (on track to hit the daily target at this rate?); money earned today.

**Automations**
- **Shift start:** the queue is built and the day plan created.
- **Mid-shift:** if 30% behind pace, a gentle nudge to the seller (no founder alert until end of day).
- **Inbound arrives:** it jumps to the top of the day plan, with a 15-minute timer.
- **Shift end:** the daily report is compiled and sent.

**Layout:** this page is a dashboard, not a list, so it doesn't use the standard list layout. Keep the metrics strip; the body is two columns (day timeline on the left, rails on the right). On phones, a single column ordered by urgency.

**Priority**
- **P0:** targets from KPIs; the empty-state button; act inline on founder decisions.
- **P1:** day timeline with tasks and meetings; snooze and reorder.
- **P2:** history picker; pace nudges.
