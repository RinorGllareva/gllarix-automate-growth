# 23 — AI call review
**Route:** `/team/calls/{review_id}` · **Mockup:** `CallReview.dc.html` · **Milestone:** M12 · **Roles:** the rep whose call it is + admins

## Layout
- **Top bar:** "TEAM / <PERSON> / CALL REVIEW"; primary BACK TO SCORECARD.
- **Header chips:** outcome (e.g. MEETING BOOKED, mint) · call type and duration (COLD CALL · 04:12). Title: "<Company> · <day> <time> <tz>".
- **Player:**
  - play/pause button (ice), waveform bars (played part cyan), time "00:00 / 04:12";
  - clicking the waveform seeks;
  - keyboard: Space plays or pauses; ←/→ moves 5 s.
- **Transcript:**
  - rows: timestamp (click seeks) · speaker (BDR cyan / PROSPECT lavender) · text · a tag line under key lines;
  - tags: e.g. OPENER 14 S · RECORDING NOTICE GIVEN (mint), DISCOVERY · MISSED CALLS, OBJECTION · SOUNDS ROBOTIC (amber), HANDLED WITH THE LIVE DEMO LINE, MISSED: JOB VALUE NOT ASKED BEFORE BOOKING (amber, row highlighted), NEXT STEP BOOKED.
- **Right column:**
  - **AI SCORE · DISCOVERY COUNTS DOUBLE:** total + per-item scores (opener, discovery, objection handling, next step) + compliance Pass/Fail. Each item links to its evidence lines in the transcript.
  - **TRY NEXT TIME:** 1–2 suggestions with an example line and the timestamp.
  - **HUMAN CHECK · <REVIEWER>** (admin): "Your score" number input + CONFIRM REVIEW; note "Within 15 points of the AI: accepted. Bigger gaps flag the rubric for review."

## Behaviour
- **Scoring:** by `services/coach.py` with `prompts/CALL_COACH_SYSTEM_PROMPT.md`. Calls under 60 s are `not_scored`.
- **Human check:** stores the reviewer's score. If |AI − human| > 15, the call is added to the rubric review list in Admin › Scoring and the prompt owner is notified.
- **Compliance fail:** flags the call red and creates a task for the co-founder.
- **Retention:** recordings are deleted after 90 days; the transcript and scores are kept 12 months, then anonymised.

## Endpoints
`GET /team/calls/{id}` · `GET /recordings/{id}` (signed URL, expiring) · `POST /team/calls/{id}/human-check`

## Acceptance criteria
- [ ] Every score shows at least one evidence line from the transcript
- [ ] Timestamps seek the audio correctly
- [ ] A gap over 15 points creates a rubric-review flag
- [ ] Recording URLs expire and are never public
- [ ] There is no emotion, sentiment or voice-tone output anywhere
