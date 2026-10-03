# Sell › Call workspace (`/call`, `/call/:leadId`)

**Job:** work the queue, one lead at a time: call, talk with the script, log the outcome in one key, and move to the next.
**Who:** admin, bdr, closer.

## Today (audit 2026-10-03)
- **Works:**
  - 3 columns: the lead, the call, the offer and history;
  - day strip;
  - inbound banner;
  - last-call card;
  - script with objection answers (tapping an objection logs it);
  - 9 outcomes on keys 1–9;
  - autosaved notes;
  - forms for callback, meeting, gatekeeper, do not contact and skip, with quick picks;
  - email composer;
  - mute and hold.
- **Missing:**
  - fake phone line;
  - keypad disabled ("arrives with Twilio");
  - the lead and contact can't be edited here;
  - history limited to 5 items;
  - no voicemail drop;
  - no local-presence caller ID;
  - no "power" auto-dial to the next lead;
  - no live transcript.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Call | Click to call (Twilio), or auto-dial the next lead when the last outcome is logged (power mode, optional) | Status, timer, recording, live transcript (later) | Mute, hold, transfer to a founder, keypad (IVR / extensions), voicemail drop (pre-recorded per list) | — |
| Outcome | Keys 1–9 (exists) | — | Change the last outcome for 10 min (undo) | — |
| Lead / contact | Add a contact (decision maker found on the call) | Lead card | **Edit inline**: contact name, title, direct line, email, a note on the company | — |
| Callback / meeting | Forms (exist) | Today's callbacks | Reschedule from here | Cancel |

**Views and sub-pages**
- **`/call`:** the workspace (exists), with the inline edits added.
- **`/call/session`:**
  - session stats: calls in this session, talk time, outcomes;
  - "Pause session";
  - session goal (e.g. 20 dials before 11:00).
- **Callback queue** inside the workspace: when a callback comes due, it's offered as the next lead.

**Metrics** (day strip, exists): dials, conversations and meetings vs targets; bonus pending. Add: connect rate this session; average call length.

**Automations**
- Outcome logged → next lead loads, plus the cadence's next step (no answer → the email goes out tomorrow).
- No answer twice → voicemail drop the second time.
- Meeting booked → confirmation and reminders, the deal moves to "Meeting booked", the bonus is pending.
- Do not contact → opt-out list, all cadences stop.

**Integrations**
- Twilio voice with recordings and a caller-ID pool per country.
- The AI coach scores the call after hang-up (server-side).
- Calendar for booking.

**Layout:** a focused 3-column workspace. This is the one page allowed to break the standard (full bleed), because it's used for hours at a time. On phones: lead card, then the call button, then the outcome grid.

**Priority**
- **P0:** inline edit of contact and lead; full history (scrollable).
- **P1:** Twilio calling (keypad, recordings); undo the last outcome; callback interleaving.
- **P2:** power dial; voicemail drop; live transcript.
