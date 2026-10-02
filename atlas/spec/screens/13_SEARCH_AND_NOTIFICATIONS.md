# 13 — Command palette (⌘K) and notifications
**Mockup:** `Overlays.dc.html` · **Milestone:** M0 (palette), M4 (notifications) · **Roles:** everyone; results follow permissions

## Command palette
- **Open:** `⌘K` / `Ctrl K` or by typing in the top-bar search. A 700 px modal over a dimmed page; `Esc` closes it.
- **Input:** large (20 px, weight 300), placeholder "Search or run a command".
- **Result groups:**
  | Group | Shows |
  |---|---|
  | LEADS | Company · city, with the tier badge |
  | DEALS | Company · stage, with the value |
  | CLIENTS | Name, status |
  | TASKS | Number, title |
  | MEETINGS | Time, company |
  | PAGES | Every sidebar page |
  | ACTIONS | Start calling my queue (G C) · Import a CSV of leads (I) · Create a deal (D) · New task (T) · Start timer (S) · Ask the AI co-founder (A) |
- **Navigation:** ↑↓ moves (the first result is highlighted ice); ↵ opens; `⌘↵` opens in a new tab.
- **Search backend:** Postgres full-text + trigram on company name, domain, phone (E.164 or digits only), contact name, deal and task titles. Respects RLS. Max 5 per group; "see all" goes to the filtered list.
- **Recent:** with an empty query, shows the 5 most recent items opened.

## Notifications panel
- **Open:** the bell in the top bar. A 420 px panel on the right; "NOTIFICATIONS · n NEW"; MARK ALL READ.
- **Items:** colored dot by type · one-line text · relative time. Clicking opens the related record.
- **Types:**
  | Event | Who gets it |
  |---|---|
  | Meeting booked | Admins + owner |
  | Deposit or payment paid | Admins |
  | Failed payment | Admins |
  | Job paused (cost cap) or failed | Admins |
  | Lead moved tier | Owner |
  | Meeting waiting for approval | Admins |
  | Daily BDR report ready | Admins |
  | Task assigned / due today / overdue | Assignee |
  | @mention in a task or comment | Mentioned person |
  | AI co-founder briefing ready | Admins |
  | Client health < 60 | Owner + admins |
- **Delivery:** in-app always; email for selected types (user preference). Real-time update via polling every 30 s (or SSE later).
- **Storage:** `notifications` (user, type, entity, text, read_at). Delete after 90 days.

## Endpoints
`GET /search?q=` · `GET /partials/notifications` · `POST /notifications/read-all` · `POST /notifications/{id}/read`

## Acceptance criteria
- [ ] Palette results appear in < 200 ms for 20,000 leads
- [ ] Phone search works with any formatting
- [ ] The BDR never sees records he can't open
- [ ] The unread count updates without a reload
- [ ] Every notification type links to the right record
