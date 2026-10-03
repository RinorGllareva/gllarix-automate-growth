# AI app: co-founder, BDR agent, performance tracker

**Rules for every AI feature:**
- prompts and keys stay on the server;
- every answer cites the Atlas data it used;
- AI never decides pay;
- every action the AI proposes needs a person to accept it;
- a monthly € cap applies to everything.

---

## AI co-founder (`/advisor`, `/advisor/:thread`)

**Job:** ask anything about the business and get an answer from our own data (pipeline, money, team, docs), with proposed actions.
**Who:** founders, sellers (if switched on).

### Today (audit 2026-10-03)
- **Works:**
  - threads with search;
  - memo or plain answer;
  - the data used, assumptions and proposed actions;
  - accept or dismiss actions (creates tasks, decisions, drafts);
  - log a memo as a decision;
  - "remember this" and memory review;
  - monthly cap.
- **Missing:**
  - fake AI provider in demo;
  - threads can't be deleted, renamed or exported;
  - no attachments (ask about a file);
  - no scheduled briefings;
  - no access to Docs as knowledge yet.

### Must-have
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Thread | Ask (exists); **from any record** ("Ask about this deal") with the record attached | Threads list (exists) | **Rename, pin, share with the other founder** | **Delete / archive**; export as Markdown |
| Memory | "Remember this" (exists) | Memory list with source | Approve / edit / expire (exists partly) | Forget |
| Briefing | Schedule: "Monday 8:00 business brief", "Friday team review" | Inbox of briefings | Edit questions and time | Stop |
| Tool access | Settings (exists) | — | Per role/person (exists) | — |

**Sub-pages:**
- **`/advisor/briefings`:** scheduled reports written by the AI.
- **`/advisor/memory`:** what the AI remembers, editable.

**Priority:**
- **P0:** delete and rename threads; "Ask about this" on records.
- **P1:** the real Claude provider via an Edge Function; Docs as a knowledge source; briefings.
- **P2:** attachments; sharing.

---

## AI BDR agent (`/ai/agent`)

**Job:** call back every inbound request within minutes, qualify it, and book a meeting with a human. It never cold-calls: an AI voice needs the person's prior consent.
**Who:** founders.

### Today (audit 2026-10-03)
- **Works:**
  - Off / Shadow / Live modes (Live is disabled);
  - settings (opening line with the AI disclosure enforced, questions, hours, call-back time, attempts, hand-off person);
  - eligibility plan;
  - shadow runs.
- **Missing:**
  - no real calling (needs Twilio and an AI voice);
  - no call results, transcripts or bookings;
  - no per-market script.

### Must-have
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Agent settings | Exists | Exists | Exists + per-market scripts and voice/language | — |
| Agent call | Automatic in Live mode | **Call log**: transcript, recording, outcome (booked / not interested / call back / wants human), duration, cost | Mark "review needed"; correct the outcome | — |
| Hand-off | When a person asks for a human or is upset | Shown in Inbound and in "Needs a founder" | Claimed by a seller | — |

**Sub-pages:**
- **`/ai/agent/calls`:** log with filters.
- **`/ai/agent/calls/:id`:** transcript and recording; "Coach this answer" feeds back into the script.

**Metrics:**
- answered within N minutes %;
- booked %;
- hand-offs;
- cost per booked meeting vs a BDR's cost per booked meeting.

**Priority:**
- **P1:** Twilio plus an AI voice in an Edge Function; call log.
- **P2:** per-market scripts; coaching loop.

---

## AI performance tracker (`/ai/tracker`)

**Job:** prepare each seller's Saturday 1:1 from the week's numbers. Sellers see their own.
**Who:** founders (everyone); sellers (themselves).

### Today (audit 2026-10-03)
- **Works:**
  - one card per seller: headline, focus for next week, wins, gaps;
  - this week vs last week table.
- **Missing:**
  - no actions;
  - rules instead of AI in demo;
  - only 2 weeks;
  - nothing feeds the 1:1 automatically.

### Must-have
- **"Add focus to 1:1":** creates the agenda item on Team › 1:1. The seller confirms the focus, which becomes a goal for next week.
- **Week picker and a 6-week trend sparkline per KPI.**
- **Coaching moments:** 3 calls to review together, picked from the week's calls, with links to call review.
- **Seller view:**
  - "My focus this week" pinned on Today;
  - the seller can add a self-review note before the 1:1.

**Priority:**
- **P1:** add to 1:1; week picker; coaching moments.
- **P2:** the real AI narrative (server-side); self-review.
