# Admin › Settings
**Route:** `/admin/settings`

## Groups (key/value in `settings`, typed form fields)
| Group | Settings |
|---|---|
| Queue | Default daily capacity per role · reserve for follow-ups % (20) · minimum new A-tier % (30) · max call attempts per 10 business days (3) · days between emails (3) |
| KPI targets | Every target from `context/03` (used by Reports and Today) |
| Commissions | Meeting bonus ($15) · setup commission % (10, min $100) · recurring commission % and months (10%, 6) · clawback days (30) · quarter bonus |
| Pricing defaults | Planning FX rate (€1 = $1.15) · overage rate ($0.25/min) · our cost per minute ($0.10) · quote validity (30 days) |
| AI | Model per job (from `config/models.yaml`) · monthly AI cost cap · AI features on/off per role |
| Retention | Recordings (90 days) · transcripts and scores (12 months) · dead leads (12 months) |
| Compliance | AI performance scoring go/no-go flag (legal check) · AI calling go/no-go per phase |
| Branding | Company names, sender names, signature, footer address (CAN-SPAM) |

## Rules
- Validation per field type and range.
- Changing commission rules applies to future events only.
- Each group saves separately, with a confirmation toast.

## Acceptance
- [ ] Every setting used elsewhere reads from here (no hard-coded values)
- [ ] Every change is in the audit log with the old and new values
