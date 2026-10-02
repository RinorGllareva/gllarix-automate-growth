# Admin › Background jobs
**Route:** `/admin/jobs`

## Content
- **Table of job types:** queue build (per owner) · nightly rescoring · imports · enrichment and audits · email reply sync · Stripe and Twilio webhooks · usage import · reports cache · AI jobs (summaries, scoring, planner, briefings) · retention purge · backups.
- **Columns:** last run · status · duration · items · cost · next run.
- **Run detail:** log lines, errors, retry.

## Actions
- RUN NOW, PAUSE/RESUME per job type, RETRY failed runs.

## Rules
- Jobs stop at a paid-API cap and alert admins.
- Failures notify admins after 2 consecutive failures.

## Acceptance
- [ ] A failed job shows its error and can be retried
- [ ] A paused job doesn't run
- [ ] Hitting a cap pauses the job and creates a notification
