# Admin › Opt-out list
**Route:** `/admin/opt-out`

## Content
- **Count + search.**
- **Table:** value (email / phone / domain) · type · reason (opt_out, do_not_call, complaint, legal) · source (call outcome, unsubscribe link, manual, import) · added by · date.

## Actions
- Add manually.
- Import a CSV.
- Remove: admin only, with a reason; it's rare and logged. Removing a "complaint" or "legal" entry needs a second admin.

## Rules
- Checked before every queue build, call and send, across both brands and all channels.
- Domain entries block every contact at that domain.

## Acceptance
- [ ] Adding a phone removes matching leads from today's queue within 1 minute
- [ ] Removal is always logged with a reason
