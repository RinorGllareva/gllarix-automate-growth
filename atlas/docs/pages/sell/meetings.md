# Sell › Meetings (`/meetings`, `/meetings/:id`)

**Job**
- **Sellers:** run every meeting prepared, log what happened, and book the next step.
- **Founders:** approve the meetings that earn the $15 bonus.

**Who:** admin, bdr, closer.

## Today (audit 2026-10-03)
- **Works:**
  - week navigation;
  - 5 KPIs;
  - calendar and list;
  - whose calendar (admin);
  - new meeting;
  - held or no-show;
  - approve with 6 checks, or reject;
  - close the month;
  - booking link;
  - **meeting page** (prep and notes, recording, attendees, approval, tasks, lead history).
- **Missing:**
  - **can't reschedule, cancel or delete**, or edit the time, type or attendee (no API);
  - no search;
  - no status or owner filter;
  - only last month can be closed;
  - no agenda template;
  - no reminders visible;
  - no follow-up email draft after a held meeting.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Meeting | Exists (modal, calendar slot, call outcome, public booking page) | Calendar (week/month), list, meeting page | **Reschedule** (drag in calendar or edit; sends an update to the attendee and the Google event); edit type, attendee, owner, video link; prep notes (exists); mark held / no-show (exists) | **Cancel** with a reason (sends a cancellation; keeps history); delete only if created by mistake (founders) |
| Approval | Automatic when marked held | Approval queue | Approve / reject (exists); reopen a decision before month close | — |
| Follow-up | After "held": "Draft follow-up" email from the notes (AI, reviewed before sending) | On the meeting page | Edit | — |
| Agenda template | Per meeting type (discovery, demo, closing) | Inserted into prep | Edit in settings | Delete |

**Views and sub-pages**
- **`/meetings`:** calendar / list (exists). Add:
  - **filters** (status: upcoming / to mark / to approve / approved / no-show; owner; type);
  - **search**;
  - an **Approvals** tab for founders: a queue with keyboard approve and reject.
- **`/meetings/:id`:** exists. Add reschedule and cancel, the follow-up draft, and an agenda template.
- **`/meetings/approvals`:** the month's approval queue with "Close month" for any open month.

**Metrics:**
- booked this week vs target;
- held;
- show rate;
- approved / booked;
- no-shows to rebook;
- bonus this week.

**Automations**
- **Confirmation:** sent at booking. **Reminders:** 24 h and 1 h before (exists). An SMS reminder too, where the country allows it.
- **Past the meeting time with no outcome logged for 2 h:** a reminder to the owner to mark it held or no-show.
- **No-show:** a follow-up email, plus a rebooking task for the next business day (exists).
- **Held:** a follow-up draft is ready, and a task "Send the quote" if no quote exists yet.

**Integrations:** Google Calendar two-way (reschedules sync both ways); Google Meet or Zoom link creation; SMS reminders through Twilio.

**Priority**
- **P0:** reschedule and cancel (with notifications); filters and search.
- **P1:** approvals queue tab; close any month; follow-up draft.
- **P2:** agenda templates; SMS reminders.
