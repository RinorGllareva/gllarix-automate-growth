# People › Hiring (`/hiring`)

**Job:** fill each opening with the right person, fast, and keep a bench of runners-up.
**Who:** founders.

## Today (audit 2026-10-03)
- **Works:**
  - openings (create and edit);
  - candidates (create, move stage by stage, scorecard 1–5, red flags, voice note link, notes);
  - bench and rejected rows;
  - hire, which starts training;
  - copy the job post.
- **Missing:**
  - can't delete openings or candidates;
  - can't edit a candidate's name, source or email (email isn't shown at all);
  - no drag-and-drop;
  - no search or filter;
  - no application form;
  - no interview scheduling;
  - no email to candidates.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Opening | Exists, plus "Duplicate opening" | Cards with pipeline counts and time-open | Edit everything; status draft → open → paused → filled → closed | Archive (keeps candidates); delete a draft |
| Candidate | Manually (exists); from the **public application page** (`/apply/:opening`: name, email, country, voice-note upload, 3 questions); CSV import | Board by stage + table view + search (name, source, flags) | Edit every field; drag between stages (server still blocks skipping a stage unless a founder overrides); scorecard; tags | GDPR delete (erase personal data, keep anonymous stats); reject with a reason template |
| Interview | "Schedule" from a candidate → picks a founder's free slot (Google Calendar) and sends an invite | Interviews this week | Reschedule, add notes and score | Cancel |
| Message | Email templates per stage: received, roleplay invite, trial week, offer, rejection | Thread on the candidate | — | — |

**Views and sub-pages**
- **`/hiring`:** opening cards and the board for the selected opening (exists). Add drag-and-drop, search and a source filter.
- **`/hiring/candidates/:id`:** candidate record:
  - scorecard;
  - voice note player;
  - roleplay recordings;
  - notes;
  - emails;
  - timeline;
  - "Hire" or "Reject".
- **`/hiring/openings/:id`:** the post, where it's published, applicant sources and funnel conversion.
- **`/apply/:slug`:** a public application page in the same style as `/book`.

**Metrics:** applicants this week by source; time from application to decision; pass rate per stage; bench size.

**Automations**
- New application: auto-reply email, plus a founder task when it scores 4 or more on the screen.
- Candidate idle 5 days in a stage: reminder.
- On hire: an Atlas account is created (invite), training starts and the onboarding tasks are made.

**Integrations:** Google Calendar for interviews; email for templates; the job post copied to LinkedIn, Indeed or Venezuela groups (manual for now).

**Priority**
- **P0:** edit all candidate fields; delete or archive; search; drag-and-drop.
- **P1:** candidate record page; email templates; interview scheduling.
- **P2:** public application page; source analytics.
