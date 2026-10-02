# 05 — Lead detail (with 5 tabs)
**Route:** `/leads/{id}?tab=timeline|contacts|signals|deals|files` · **Mockup:** `LeadDetail.dc.html` · **Milestone:** M1–M2 · **Roles:** admin; BDR (own leads); viewer (read-only)

## Purpose
Everything about one company: history, people, why it scored, the rules for contacting it, and the suggested offer.

## Header
- **Chips:** brand(s) (e.g. ARCADIAN · 3D, GLLARIX CROSS-SELL), list.
- **Title:** company name (44 px weight 300).
- **Sub-line:** industry · city, country · local time · owner · stage.
- **Actions:**
  - CALL → `/call/{id}`;
  - EMAIL (compose, compliance-checked);
  - the next meeting, if any (ice button, opens the meeting) or BOOK MEETING;
  - CREATE DEAL (top bar).
- **Inline edits:** stage dropdown, owner (admin), tags.

## Tabs
### Timeline (default)
- All activities, newest first: date, colored dot by type, title, sub-line.
- **Types:** call (outcome, duration, recording link), email (sent/opened/replied), LinkedIn task, meeting, signal found, score change, import/created, stage change, note.
- **Add note** box at the top.
- **Filter by type.**

### Contacts
- Table: name, role, email (+ status), phone (+ type, verified), LinkedIn, decision-maker flag, primary flag.
- Add/edit contact; set primary; mark the email or phone invalid.
- **Opt-out per contact:** shows an opt-out badge; the contact can't be contacted.

### Signals
- List: signal key (human label), value, source, observed date, expiry, points it adds.
- Expired signals are greyed and don't score.
- RE-ENRICH button runs the audit and enrichment for this lead.

### Deals
- The deals for this lead: brand, stage, setup, monthly, owner, updated.
- NEW DEAL.

### Files
- Attachments (Supabase Storage): proposals, floor plans, recordings exported; upload, preview, delete (admin).

## Right column (on all tabs)
| Card | Content |
|---|---|
| Score | Model name, score + tier, every rule that fired with points, model version + "rescored hh:mm" |
| Contacts (compact) | The top 2 contacts |
| Outreach rules · <country> | `compliance` results per channel (email, call, LinkedIn): allowed/blocked + reason; lawful basis; source |
| Suggested offer | From the list + signals: lead offer with price (market-aware) + cross-sell (e.g. 3D sales platform €12,000 + €449/mo; sales-office receptionist $1,500 + $699/mo) |

## Endpoints
- `GET /leads/{id}`
- `GET /partials/leads/{id}/{tab}`
- `POST /leads/{id}/notes`
- `PATCH /leads/{id}` (stage, owner, tags)
- `POST /leads/{id}/contacts`
- `PATCH /contacts/{id}`
- `POST /leads/{id}/reenrich`
- `POST /leads/{id}/files`

## Acceptance criteria
- [ ] Every tab loads as a partial without a full reload, and the URL updates
- [ ] The score breakdown equals the stored score
- [ ] The outreach rules card matches `compliance.can_contact` for each channel
- [ ] A stage change writes a timeline entry and the audit log
- [ ] The BDR gets 403 on a lead he doesn't own
