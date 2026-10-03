# Atlas design

- **Look (2026-10-02, replaces the first gllarix.com match):**
  - The base is Raycast-style:
    - near-black canvas `#07080A` with layered surfaces (`#111214`, `#18191C`);
    - translucent 1 px edges with an inset top highlight;
    - 8 px buttons and inputs, 12 px cards;
    - keycaps (`.kbd`) for shortcuts.
  - The brand accent is the Arcadian / Gllarix ice blue `#9CC7E6`, used for links, focus and the Sell app. Red `#FF6363` is only for errors and danger.
  - Type:
    - Inter for the interface (13–14 px, 500 for labels, sentence case; no tracked uppercase);
    - page titles at 26 px / 600;
    - Geist Mono for numbers.
  - The primary button is light on dark. Other buttons are dark and glossy with an inset edge.
  - Light mode uses soft greys, never white.
- **Apps:** one platform, one login, with an app switcher (Sell, Work, Money, People, Growth, AI). Each app has an accent hue, which goes into `--app` for the active nav item, focus rings and tabs. The structure is defined in `src/lib/nav.ts` (`APPS`).
- **Tokens:** `design/tokens.css` (a copy of `src/styles/tokens.css`). Use these CSS variables in the app; never hard-code colors.
- **Mockups:** the `.dc.html` mockups below show the first look (square, uppercase). Their layouts still apply; colors and type follow the tokens.
- **Mockups:** `design/mockups/*.dc.html` (one file per screen; open the live canvas for the real view). Screens:

| File | Screen |
|---|---|
| Login.dc.html | Sign in |
| Main.dc.html | Today (queue progress, KPI cards, up next, queue mix, needs attention) |
| Call.dc.html | Call workspace (lead card + score reasons + compliance, live call, script, notes, 9 outcome buttons, offer, history) |
| Leads.dc.html | Leads list with filter chips and bulk actions |
| LeadDetail.dc.html | Lead detail (timeline, score breakdown, contacts, outreach rules, suggested offer) |
| Import.dc.html | CSV import (steps, duplicate report, assign) |
| Pipeline.dc.html | Pipeline board, brand filter |
| Meetings.dc.html | Meetings week + approval checklist and bonus |
| Deal.dc.html | Deal and quote builder (price book maths, totals, deposit link, quote status) |
| Clients.dc.html | Clients, onboarding checklist, usage and overage, next invoice, health |
| Reports.dc.html | Weekly funnel, MRR vs €10k plan, KPI status, stage gates |
| Admin.dc.html | Admin sections, country rules, jobs, cost caps, opt-out list |
| Overlays.dc.html | ⌘K command palette and notifications panel |
| StyleGuide.dc.html | Colors, type, components |
| Tasks.dc.html | Tasks list view grouped by status |
| TaskBoard.dc.html | Tasks board view |
| TaskDetail.dc.html | Task detail: subtasks, comments, time, dependencies, AI note |
| Timeline.dc.html | Timeline (Gantt) with capacity rows |
| Workload.dc.html | Workload per person per week, availability, AI suggestions |
| Planner.dc.html | AI planner: idea → proposed, scheduled tasks → accept |
| Team.dc.html | Team performance overview: per-person results vs targets, AI coaching focus, what's working, guardrails |
| Scorecard.dc.html | Personal scorecard (visible to the person): weekly KPIs, call-quality rubric, 1:1 agenda, rule-based earnings, comments |
| CallReview.dc.html | AI call review: recording, tagged transcript, rubric scores, suggestion, human check |
| Time.dc.html | Time tracking: running timer, weekly timesheet, week vs capacity, estimates vs actual |
| TimeReports.dc.html | Time reports: hours by client/project, revenue per hour, founder weekend hours, estimate accuracy |
| Advisor.dc.html | AI co-founder: threads, board-memo answer, data it used, assumptions, proposed actions |
| Sidebar.dc.html, TopBar.dc.html, TaskSpaces.dc.html, ViewTabs.dc.html | Shared layout parts |

The `.dc.html` files use the design-canvas format (inline styles, `sc-for` loops, `renderVals()` sample data). Treat them as the visual spec, not production code: rebuild each screen in Jinja2 + HTMX with the tokens above.
