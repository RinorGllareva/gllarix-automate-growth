# Admin › Price book
**Route:** `/admin/price-book`

## Content
- **Version selector** (v2 active).
- **Tables per brand:** item code · name · group · setup · monthly · included minutes · max qty · requires / included_with · active.
- **Market levels:** US 100% · W. Europe 100% · CH 125% · XK 50% · Gulf (open).
- **Discount rules:** bundle %, cross-sell %, rush %, pilot setup % and monthly %, pilots per brand, BDR/closer discount limits.

## Actions
- Create a new version: copy, edit, then activate. Activation needs a second admin's confirmation.
- PARITY CHECK runs the parity fixtures against the current version and shows pass/fail.

## Rules
- Existing quotes keep their version.
- `config/price_book_v2.yaml` and `pricing/price-calculator.html` must stay in sync: the parity check fails if they differ.

## Acceptance
- [ ] Activation requires two admins
- [ ] Parity check results are shown
- [ ] Old quotes don't change
