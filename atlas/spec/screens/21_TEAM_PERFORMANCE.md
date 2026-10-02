# 21 — Team performance
**Route:** `/team?week=` · **Mockup:** `Team.dc.html` · **Milestone:** M12 · **Roles:** admin (all people); BDR (redirected to his own scorecard); viewer (team totals only)
**Guardrails (from A17, enforced in code and tests):** work data only · no single employee score · no ranking · no emotion or voice analysis · pay never reads AI scores · the legal go/no-go flag in Settings must be on for AI scoring to show.

## Layout
- **Top bar:** context "WEEK nn · dates · VISIBLE TO EACH PERSON"; primary PREPARE 1:1S (generates all weekly agendas).
- **Header:** label "RESULTS, QUALITY AND RELIABILITY AGAINST YOUR TARGETS"; title; right note "No single 'employee score' · AI suggests, people decide".
- **Person cards** (3 columns; one per person with a role, plus the Codex agent). Each card shows:
  - number · name · role and hours;
  - 4 stats with value and target note: e.g. booked/week, close rate, call quality (human-checked), CRM same day. Co-founder: meetings run, close rate, queue done, tasks on time. Codex: PRs merged, first-pass OK, review time, tests added. Color by status (mint met / amber watch);
  - an AI COACHING FOCUS paragraph from the latest weekly summary.
  - Click → `/team/{user_id}`.
- **WHAT'S WORKING · FROM n SCORED CALLS:** rows: pattern · effect (e.g. "2.1× more") · metric (meetings booked, conversations, connect rate). Only patterns backed by at least 30 calls.
- **HOW THIS IS MEASURED:** the guardrail list as plain sentences.

## Behaviour
- **Weekly stats:** computed by the weekly job (Sunday night), plus live current-week values.
- **Codex agent stats:** from GitHub-linked tasks.
- **Legal flag off:** the call-quality stat and coaching focus show "AI scoring is off until the legal check is done", and only results and discipline KPIs show.
- **Audit:** every view of this page is logged in `audit_log`.

## Endpoints
`GET /team` · `POST /team/one-on-ones/prepare` · `GET /partials/team/insights`

## Acceptance criteria
- [ ] No element ranks or orders people by a score (tested in templates)
- [ ] The BDR is redirected to his own page; the viewer sees totals only
- [ ] "What's working" hides patterns with fewer than 30 calls
- [ ] With the legal flag off, no AI scores render anywhere
