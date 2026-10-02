# 14 — Style guide
**Route:** `/styleguide` (admin; also enabled in dev) · **Mockup:** `StyleGuide.dc.html` · **Milestone:** M0

## Purpose
A living page that renders every token and component from the real templates, so design drift is visible.

## Sections
1. **Color:** 12 swatches with name and hex, read from `tokens.css` variables: ground, surface, hairline, text, secondary, muted, ice (active), cyan · Gllarix, mint · good, lavender, amber · Arcadian, coral · stop.
2. **Type:** display 56 · page title 40 · section 24 light · body 15 · label 11 tracked caps · mono for numbers.
3. **Components (from the real partials):**
   - buttons: primary, outline, danger;
   - text input, select, checkbox, toggle;
   - tier badges A–D, brand chips (GLLARIX, ARCADIAN), stage chip, status chips (ON TRACK, WATCH, OFF TRACK);
   - KPI card;
   - table row;
   - active menu item;
   - toast;
   - empty state;
   - skeleton row;
   - modal;
   - side drawer.

## Rules
Every new partial must be added here in the same PR (part of the definition of done).

## Acceptance
- [ ] It renders without errors with no data
- [ ] Every component uses only tokens
