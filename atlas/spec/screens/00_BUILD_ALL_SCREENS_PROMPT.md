# Prompt: build all Atlas screens

_Paste this into Claude Code (or Codex) at the root of the repo. It references files; the agent reads them itself._

---

You are building the user interface of **Atlas**, the internal CRM and operations system for Arcadian and Gllarix. The backend spec, data model and business rules are in `prompts/CRM_BUILD_PROMPT.md` (Part A). The visual design is in `design/` (tokens + mockups). The exact behaviour of every screen is in `screens/`.

**Read first, in this order:**
1. `AGENTS.md`
2. `prompts/CRM_BUILD_PROMPT.md` Part A
3. `screens/00_README_AND_CONVENTIONS.md`
4. `screens/00_SHARED_LAYOUT.md`
5. `design/README.md`
6. `design/tokens.css`

**Then build every screen in `screens/`, in this order:**
- **Foundation:** shared layout → sign in → style guide → admin shell and sections → command palette and notifications.
- **Leads:** leads list → lead detail → import.
- **Daily work:** Today → call workspace.
- **Sales:** meetings → pipeline → reports → deal and quote → clients and usage.
- **Work management:** tasks list → board → task detail → timeline → workload → AI planner.
- **Time:** time my week → time reports.
- **AI and people:** team performance → scorecard → call review → AI co-founder.

**Rules:**
1. **For each screen:**
   - Implement every section of its file: layout, data, actions, states, endpoints, keyboard and acceptance criteria.
   - Match the mockup it names in `design/mockups/`.
   - Use only `design/tokens.css` values.
2. **Data and rules:**
   - Create any table or field the screen needs that's listed in A6–A19, with an Alembic migration and RLS. Don't invent fields that aren't in the spec; if one is truly missing, add it to `docs/QUESTIONS.md` and use the smallest sensible default.
   - Business rules (prices, scoring, queue limits, country rules, commissions) come from `config/*.yaml` and the services in `app/services/`. Never hard-code them in templates.
   - AI features call `AIProvider` with a fake provider in tests. Nothing AI-generated is saved without a human Accept.
3. **Tests:**
   - Every screen gets: route tests for each role (allowed and forbidden), the empty state, the main action, and a Playwright smoke test.
   - Run the full test suite after each screen; fix failures before moving on.
4. **Seed data:** seed realistic fake data (`scripts/seed.py`) so every screen shows something on first run. Never use real people or companies.
5. **Commits:** one commit per screen, with the message `screen: <name>`.
6. **Finish with:**
   - a `docs/SCREENS_STATUS.md` table: screen · done/partial · gaps · questions;
   - a short run guide in `docs/RUNBOOK.md`.

**Definition of done for the whole job:**
- `docker compose up`, then log in as each seeded role (admin, bdr, viewer).
- Every route in `screens/00_README_AND_CONVENTIONS.md` loads with seeded data.
- All acceptance criteria pass.
- The test suite is green.
