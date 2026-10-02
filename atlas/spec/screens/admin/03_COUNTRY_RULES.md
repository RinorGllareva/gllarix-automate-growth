# Admin › Country rules
**Route:** `/admin/country-rules` (the default admin section) · **Mockup:** the center of `Admin.dc.html`

## Content
- **Title:** "Country rules".
- **Amber banner:** "n of m markets are not yet confirmed by a lawyer. They show a warning until someone marks them verified."
- **Table:** MARKET (ISO code) · CALLS (allowed / hours / "No") · COLD EMAIL (Yes / Limited / No) · NOTES · VERIFIED (YES mint / NOT YET amber).
- **Row edit** (side drawer):
  - calls allowed, call hours (local), required screening (TPS/CTPS, Swiss directory asterisk), email (yes / conditional / no) with a condition note, SMS allowed;
  - verified checkbox + verified by + date + source note.

## Rules
- Loaded from `config/country_rules.yaml` on deploy. Admin edits are stored in the database and override the YAML.
- **Unverified markets:** outreach still works if allowed, but every lead in that market shows a warning.
- **Blocked channels:** enforced by `compliance.can_contact` everywhere (queue, call button, email sender).

## Acceptance
- [ ] Changing a rule changes compliance results immediately
- [ ] Marking verified requires a source note
- [ ] DE/AT calls and CH cold email are blocked by default
