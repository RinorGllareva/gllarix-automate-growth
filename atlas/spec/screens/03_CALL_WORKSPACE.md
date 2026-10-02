# 03 — Call workspace
**Route:** `/call` (next queue item) · `/call/{lead_id}` · **Mockup:** `Call.dc.html` · **Milestone:** M3 · **Roles:** BDR, closer, admin

## Purpose
The screen the BDR lives in. One lead at a time: call, talk with the script, log the outcome in one key press, next lead. Target: under 5 s per outcome.

## Layout (3 columns: 330 px · flexible · 300 px)
### Left: the lead
| Region | Content |
|---|---|
| Chips | Brand (GLLARIX cyan / ARCADIAN amber), list + industry |
| Title | Company name (30 px, weight 300) |
| Sub-line | City, state · **local time** (mono) · reviews count · rating |
| Score card | Tier box (e.g. 80 / TIER A, colored by tier) + main contact name, role, phone (mono), "Direct line · verified" |
| Why this score | The top 6 rules from `score_breakdown` with points (+15 …), "+ n more rules · see lead detail" |
| Calling rules | Shield icon + the result of `compliance.can_contact(lead, 'call', now)`: "Allowed to call: US, dialed by hand, inside calling hours, not on the opt-out list" — or a coral **blocked** message with the reason, and the call button disabled |

### Center: the call
| Region | Content |
|---|---|
| Call bar | Status (READY / RINGING / CONNECTED / ENDED), timer (mono 34 px), buttons: CALL (when idle), MUTE, HOLD, KEYPAD, END CALL (coral) |
| Script | Label "SCRIPT · <list> · OPENER UNDER 20 SECONDS". The opener with the recording notice, from the script library for the lead's list and brand; contact name and BDR name filled in. 3 numbered discovery questions; objection chips (click → show the answer inline) |
| Notes | Textarea saved automatically (debounced 1 s) to the call activity |
| Outcome | Label "OUTCOME · PRESS 1–9". 3×3 buttons from `dispositions.yaml` with key badges: 1 No answer · 2 Voicemail · 3 Gatekeeper · 4 Wrong number · 5 Not interested · 6 Call back · 7 Send info · **8 Meeting booked** (ice) · 9 Do not contact (coral) |

### Right: offer and history
| Region | Content |
|---|---|
| Offer card | Offer name for the list (e.g. NEVER MISS A JOB): list price and pilot price from the price book (market-aware), pilots left. Buttons: CREATE QUOTE → `/deals/new?lead={id}`, SEND DEMO LINE (sends the demo number by email where allowed) |
| History | The last 5 activities: time, short text (emails opened, score changes, import source, assignment) |
| Footer | Shortcut help + "Next up: <company> · <city>" |

## Outcome behaviour (from A7)
| Key | Outcome | What happens |
|---|---|---|
| 1 | No answer | attempts+1 → next call per cadence |
| 2 | Voicemail | attempts+1 → next call per cadence; no voicemail drop |
| 3 | Gatekeeper | Ask for the gatekeeper name (optional) → retry next business day in a different window |
| 4 | Wrong number | Phone marked invalid → re-enrichment job → removed from today |
| 5 | Not interested | Stage Nurture → email in 90 days (where legal) |
| 6 | Call back | Inline date/time picker in the **lead's local time** → task |
| 7 | Send info | Email task now (template picker) + call in 2 business days |
| 8 | Meeting booked | Inline form: date and time (lead-local), with whom, type → creates the meeting + calendar invite → stage Meeting booked |
| 9 | Do not contact | Confirm dialog ("Removes from all lists and channels") → opt-out list → all cadences stop → stage Lost (opt-out) |

After any outcome:
- the activity is saved with duration and the recording URL;
- the next task is created;
- the queue position advances;
- the next lead loads in place (HTMX swap, no full reload) within 300 ms.

## Telephony
- Browser calling through `TelephonyProvider` (Twilio Client). A fake provider in dev and tests.
- Caller ID: from the number pool, chosen by area code if available.
- Recording is on for calls over 60 s; the notice is in the opener.
- Call **blocked** when the compliance check fails; the CALL button is disabled with the reason.

## Keyboard
| Key | Action |
|---|---|
| `C` | Call / hang up |
| `1`–`9` | Outcome |
| `N` | Skip to the next lead (requires an outcome or a skip reason) |
| `E` | Email |
| `B` | Book meeting |
| `M` | Mute |
| `?` | Shortcut help |

None of these fire while typing in notes.

## Endpoints
- `GET /call`
- `GET /call/{lead_id}`
- `POST /calls/start`
- `POST /calls/{id}/end`
- `POST /leads/{id}/outcome` (body: disposition + extras) → returns the next-lead partial
- `PATCH /activities/{id}/notes`
- `GET /partials/script/{lead_id}`

## States
- **Queue finished:** "Queue done. Great work." + today's numbers + a "Pull 20 more leads" button (if a shortfall exists).
- **Telephony unavailable:** a banner; log outcomes manually.
- **Lead already being worked by someone else:** a read-only warning.

## Acceptance criteria
- [ ] 20 leads worked in a row with keyboard only; every outcome under 5 s end to end
- [ ] Each outcome creates exactly the next task in A7
- [ ] "Do not contact" removes the lead from every queue immediately
- [ ] A blocked lead (country or hours) can't be called
- [ ] Local time is correct across US time zones and daylight-saving changes
- [ ] Notes are never lost when changing leads quickly
