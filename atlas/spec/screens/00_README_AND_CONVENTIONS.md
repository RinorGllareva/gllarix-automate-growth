# Atlas screens — specs for every page and sub-page

One file per screen. Read this file first; every screen file assumes these conventions and doesn't repeat them.

**Sources of truth, in order:**
1. `prompts/CRM_BUILD_PROMPT.md` (data model A6, rules A7–A19)
2. `config/*.yaml`
3. these screen files
4. `design/mockups/*.dc.html` (visual reference only; sample data in mockups is fictional)

## File index
| # | Screen | File | Route | Milestone |
|---|---|---|---|---|
| — | Shared layout: sidebar, top bar | `00_SHARED_LAYOUT.md` | all | M0 |
| — | Global: command palette, notifications | `13_SEARCH_AND_NOTIFICATIONS.md` | overlay | M0 / M4 |
| 01 | Sign in | `01_SIGN_IN.md` | `/login` | M0 |
| 02 | Today | `02_TODAY.md` | `/today` | M3 |
| 03 | Call workspace | `03_CALL_WORKSPACE.md` | `/call`, `/call/{lead_id}` | M3 |
| 04 | Leads list | `04_LEADS_LIST.md` | `/leads` | M1 |
| 05 | Lead detail (+ 5 tabs) | `05_LEAD_DETAIL.md` | `/leads/{id}?tab=` | M1–M2 |
| 06 | Import leads (4 steps) | `06_IMPORT.md` | `/leads/import` | M1 |
| 07 | Pipeline board | `07_PIPELINE.md` | `/pipeline` | M4 |
| 08 | Meetings and approval | `08_MEETINGS.md` | `/meetings`, `/meetings/{id}` | M4 |
| 09 | Deal and quote builder | `09_DEAL_AND_QUOTE.md` | `/deals/{id}`, `/deals/new` | M6 |
| 10 | Clients and usage | `10_CLIENTS_AND_USAGE.md` | `/clients`, `/clients/{id}` | M7 |
| 11 | Reports | `11_REPORTS.md` | `/reports` | M4 |
| 12 | Admin shell + 10 sections | `12_ADMIN.md` + `admin/*.md` | `/admin/{section}` | M0–M2 |
| 14 | Style guide | `14_STYLE_GUIDE.md` | `/styleguide` | M0 |
| 15 | Tasks list (+ My work, Inbox) | `15_TASKS_LIST.md` | `/tasks` | M9 |
| 16 | Tasks board | `16_TASKS_BOARD.md` | `/tasks/board` | M9 |
| 17 | Task detail | `17_TASK_DETAIL.md` | `/tasks/{id}` | M9 |
| 18 | Timeline | `18_TIMELINE.md` | `/tasks/timeline` | M10 |
| 19 | Workload and availability | `19_WORKLOAD.md` | `/tasks/workload` | M10 |
| 20 | AI planner | `20_AI_PLANNER.md` | `/planner` | M11 |
| 21 | Team performance | `21_TEAM_PERFORMANCE.md` | `/team` | M12 |
| 22 | Scorecard | `22_SCORECARD.md` | `/team/{user_id}` | M12 |
| 23 | AI call review | `23_CALL_REVIEW.md` | `/team/calls/{review_id}` | M12 |
| 24 | Time tracking: my week | `24_TIME_MY_WEEK.md` | `/time` | M13 |
| 25 | Time reports | `25_TIME_REPORTS.md` | `/time/reports` | M13 |
| 26 | AI co-founder | `26_AI_COFOUNDER.md` | `/advisor`, `/advisor/{thread_id}` | M14 |

## Conventions (apply to every screen)
**Stack:**
- FastAPI routes return full pages (Jinja2) for normal navigation, and HTML partials for HTMX requests (`HX-Request` header).
- One template per screen in `app/web/templates/screens/`, partials in `.../partials/`.
- Every write is a POST/PATCH/DELETE that returns the updated partial plus an `HX-Trigger` event for toasts.

**Design:**
- Only the tokens in `design/tokens.css`: dark ground, 1 px hairlines, square corners, Geist / Geist Mono.
- 11 px uppercase tracked labels; page titles 40 px weight 300.
- Primary button = ice fill with dark text; secondary = 1 px outline.
- Colors carry meaning: cyan = Gllarix/links, mint = good/tier A, lavender = pending/tier C, amber = Arcadian/warning, coral = stop/error.

**Layout:** the sidebar (240 px) + top bar (72 px) shell from `00_SHARED_LAYOUT.md` on every authenticated page. Content padding 28–32 px × 40 px. Minimum width 1280 px (desktop tool); below 1024 px, show a "use a larger screen" notice, except Today, Scorecard and AI co-founder, which must work on a 390 px phone.

**Money and time:**
- Money is stored as integer minor units + currency, shown with the currency symbol and thousands separators in Geist Mono.
- Times are stored in UTC. Show them in the viewer's timezone, except a lead's local time, which is labelled "local".
- Dates: `Tue 1 Dec`, or `01/12/2026` in tables.

**Permissions:**
- Every route checks the role (A5). Row-level security in Postgres is the second line.
- A forbidden route returns 403 with a plain message, never a blank page.
- Hidden actions are removed from the HTML, not just disabled.

**States every screen must handle:**
- **Loading:** skeleton rows, never spinners on the whole page.
- **Empty:** one sentence explaining why it's empty, plus the next action.
- **Error:** an inline message, and a retry for that region only.
- **No permission.**
- **Stale data:** show "updated 3 min ago" for anything computed by a job.

**Audit:** every create/update/delete writes `audit_log` (user, action, entity, before, after).

**Accessibility:**
- Real `<button>`, `<a>`, `<label>`.
- Focus visible; every icon button has an `aria-label`; contrast ≥ 4.5:1.
- Keyboard shortcuts never fire while typing in an input.

**Performance:** server time < 500 ms per page; lists paginate at 50 rows (cursor); one-click actions respond in < 300 ms.

**Testing:** each screen gets route tests (role access, happy path, empty state) and one Playwright smoke test of its main action.

**Copy:** plain English, sentence case, no unproven claims, AI features labelled "AI".
