# Admin › Scoring models
**Route:** `/admin/scoring`

## Content
- **Tabs:** Trades · Developers.
- **Rules table:** rule id · condition (human-readable) · points (negative in coral; "exclude" in coral) · expiry days · leads affected (count).
- **Tier thresholds:** A 70 · B 50 · C 30.
- **Model version** + "last rescore".

## Actions
- Edit points, thresholds and expiry (a new model version is created on save).
- RESCORE ALL (job).
- **Preview impact:** shows how many leads change tier before saving.
- **Conversion by tier and signal** (after 500+ contacted leads): table + a "suggest weights" button (logistic regression, admin accepts).

## Rules
- YAML is the seed. Saved edits create `score_model_version` rows; leads store the version used.

## Acceptance
- [ ] The preview shows correct tier changes
- [ ] Saving creates a new version, and rescoring uses it
- [ ] Exclusion rules remove leads from queues
