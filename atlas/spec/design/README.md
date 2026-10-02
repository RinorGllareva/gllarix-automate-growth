# Atlas design

- **Look:** matched to gllarix.com from screenshots:
  - near-black ground, 1 px hairlines, square corners;
  - light Helvetica-style grotesque (Geist, weight 300) for big numbers and titles;
  - 11 px tracked uppercase labels;
  - ice-white active state;
  - cyan/mint accents, lavender and amber secondary.
- **Tokens:** `design/tokens.css`. Use these CSS variables in the app; never hard-code colors.
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
