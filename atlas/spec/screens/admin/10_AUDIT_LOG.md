# Admin › Audit log
**Route:** `/admin/audit`

## Content
- **Filters:** user, entity type, action, date range.
- **Table:** time · user · action · entity (link) · summary.
- **Detail drawer:** before/after JSON diff.
- **Includes:** views of personal scorecards (file 22) and exports.

## Rules
- Read-only, append-only; retained for 24 months.
- Exportable to CSV (admin), and the export itself is logged.

## Acceptance
- [ ] Every write anywhere appears here within seconds
- [ ] The diff view shows only the changed fields
