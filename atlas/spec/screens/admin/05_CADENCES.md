# Admin › Cadences
**Route:** `/admin/cadences`

## Content
- **List:** cadence name · list type · steps · active leads.
- **Editor:** ordered steps with day offset · channel (call / email / LinkedIn task) · template (for email and LinkedIn) · time window rule.
- **Templates sub-tab:** email and LinkedIn templates with variables (`{{contact.first_name}}`, `{{company.name}}`, `{{bdr.name}}`, `{{demo_number}}`) and a preview with a real lead.

## Rules
- Seeds: Trades v1, Developers v1 (from `config/queue.yaml`).
- Editing a cadence affects only future steps.
- Email templates must include the unsubscribe link and the footer address.

## Acceptance
- [ ] A new cadence can be assigned in bulk from the leads list
- [ ] An email template can't be saved without an unsubscribe variable
