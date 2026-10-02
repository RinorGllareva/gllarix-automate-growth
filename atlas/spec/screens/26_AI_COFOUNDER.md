# 26 — AI co-founder
**Route:** `/advisor` (new thread) · `/advisor/{thread_id}` · **Mockup:** `Advisor.dc.html` · **Milestone:** M14 · **Roles:** admins (all tools); BDR (role-limited: no finance, no other people's data); viewer (off by default)
**Runtime prompt:** `prompts/AI_COFOUNDER_SYSTEM_PROMPT.md` · **Model:** from `config/models.yaml` (Opus 5.5 for memos, Sonnet 5 for quick lookups)

## Layout (3 columns: 220 px · flexible · 290 px)
- **Threads (left):**
  - label THREADS;
  - items with title + meta ("BOARD MEMO · TODAY", "AUTO · MON 07:00", "PRICING · YESTERDAY"); the active one is ice;
  - top-bar primary NEW QUESTION;
  - search threads.
- **Conversation (center):**
  - user messages on the right in an outline box;
  - AI answers in a surface card. A **board memo** has:
    - a header: BOARD MEMO + the roles used (CEO, CFO, OPERATIONS, RISK chips) + CONFIDENCE (low/medium/high, amber);
    - a short answer (17 px weight 300);
    - an options table: OPTION · COST / MO · EFFECT IN · RISK · PICK (NO coral / YES mint / WITH B);
    - FASTEST ROUTE (mint label) and MOST PROFITABLE (lavender label) side by side;
    - RISKS (amber label).
  - Quick questions get short answers, with sources inline.
  - **Input bar (bottom):** placeholder "Ask about pricing, cash, hiring, a client, a risk…" · role selector "ALL ROLES ⌄" (CEO, CFO, COO, CTO, CRO/CMO, Risk, People) · send (→). Shift+Enter makes a new line.
- **Right panel (for the selected answer):**
  - **DATA IT USED:** every tool call with ✓ and a one-line result (`get_kpis(week=48)` → "MRR €456 · 5 meetings booked · close 25%").
  - **ASSUMPTIONS:** an amber box listing each assumption and its source ("Reserve €3,000 · from your message").
  - **PROPOSED ACTIONS:** cards (task title · owner · hours · date) + ACCEPT n TASKS (creates the tasks via the planner) + LOG AS PROPOSED DECISION (creates a `decisions` row with status proposed).

## Behaviour
- **Answering:**
  - streams the answer;
  - tools run as the asking user (RLS); the panel fills as tools return;
  - every number must come from a tool or a file citation, or be labelled as an assumption;
  - legal, tax or contract topics end with "confirm with a professional".
- **Context:** core context (`context/00`–`08`, the latest update, the decision log) is sent with prompt caching; the knowledge version is shown in the footer.
- **Memory:** "Remember this" on any message → a draft memory fact; an admin approves it into `advisor_memory`.
- **Scheduled threads:**
  - Monday briefing (07:00 CET);
  - month-end close (1st);
  - alerts (cash below reserve, gate passed, churn risk, cap hit, plan slip): each posts a thread and a notification.
- **Limits:** the monthly AI cost cap blocks new questions with a message. Every message, tool call and its cost is logged.

## Endpoints
- `GET /advisor` · `GET /advisor/{thread_id}`
- `POST /advisor/{thread_id}/messages` (SSE stream)
- `POST /advisor/actions/{id}/accept`
- `POST /advisor/messages/{id}/remember`
- `GET /advisor/search?q=`

## Acceptance criteria
- [ ] All 20 evaluation questions in `backbone/08_AI_COFOUNDER.md` use the expected tools or files
- [ ] The BDR asking about cash gets "not available for your role"
- [ ] No tool changes data; only Accept creates tasks or decisions
- [ ] Every figure in a memo has a source or an assumption label
- [ ] The Monday briefing thread is created on schedule with KPIs, gates, risks and 3 tasks
- [ ] It works at 390 px (threads become a drawer)
