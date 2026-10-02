# Shared layout: sidebar and top bar
**Mockups:** `Sidebar.dc.html`, `TopBar.dc.html`
**Applies to:** every authenticated page
**Milestone:** M0

## Sidebar (240 px, full height)
| Region | Content |
|---|---|
| Brand | Hexagon mark + "ATLAS" (tracked caps) + "BY GLLARIX". Links to `/today` |
| Label | "WORKSPACE" |
| Nav items (40 px rows) | Today `/today` (G T) · Call workspace `/call` (G C) · Leads `/leads` (G L) · Pipeline `/pipeline` (G P) · Meetings `/meetings` (G M) · Deals and quotes `/deals` (G D) · Clients `/clients` (G K) · Reports `/reports` (G R) · Tasks and planner `/tasks` (G W) · Team performance `/team` (G E) · Time tracking `/time` (G H) · AI co-founder `/advisor` (G I) · Admin `/admin` (G A) |
| Active item | Ice background `--ice`, dark text and icon. Others: `--text-2`, icon `--text-3` |
| Queue card (bottom) | "QUEUE x / capacity" + 3 px progress bar (cyan) + the current calling window ("East window open until 09:00 ET"). Only for users with a daily capacity (BDR, co-founder) |
| User block | Initials square, name, role. Click → menu: profile, timezone, sign out |

**Visibility by role:**
| Role | Sees |
|---|---|
| Admin | All items |
| BDR | Today, Call, Leads, Pipeline, Meetings, Deals, Tasks, Team performance (own scorecard only), Time, AI co-founder (role-limited) |
| Viewer | Reports, Team performance (totals), Pipeline (read-only) |
| Implementer | Clients, Tasks, Time |

**Keyboard:** `G` followed by the letter navigates; the shortcut is shown right-aligned on each item.

## Top bar (72 px)
| Region | Content and behaviour |
|---|---|
| Search field (380 px) | Placeholder "Search leads, companies, deals"; `⌘K` / `Ctrl K` opens the command palette (file 13). Typing here opens the same palette with the text |
| Context label | Page-specific, tracked caps, e.g. "TUE 1 DEC · BDR SHIFT 08:00–16:00 VET", "LEADS / THAMESIDE HOMES" |
| Notifications button | Bell + cyan dot when unread; opens the notifications panel (file 13). `aria-label` includes the unread count |
| Primary action | Page-specific outline button with an arrow, e.g. START CALLING → `/call`, IMPORT CSV, CREATE DEAL, PLAN WITH AI |
| Running timer bar | When a timer runs (file 24), a 36 px strip under the top bar shows: task name, elapsed time, STOP |

## Endpoints
- `GET /partials/sidebar` (queue card refresh every 60 s via `hx-trigger="every 60s"`)
- `GET /partials/notifications/count`
- `POST /timer/stop`

## Acceptance criteria
- [ ] The active item matches the current route on every page
- [ ] Hidden items for a role are absent from the HTML
- [ ] All 13 `G` shortcuts work, and don't fire inside inputs
- [ ] The queue card updates without a page reload
- [ ] Focus order: sidebar → top bar → content
