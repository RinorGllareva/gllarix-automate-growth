# Sell › Leads (`/leads`, `/leads/:id`, `/leads/import`)

**Job**
- **Founders:** import, assign and clean the lists so the queue is always full of tier A/B leads.
- **Sellers:** find any lead and see everything about it.

**Who:** admin, bdr, closer (sellers see their own leads).

## Today (audit 2026-10-03)
- **Works:**
  - **List:** paged DataTable with 6 sortable columns; column picker; search (company, phone, domain); 7 filter chips in the URL; select all matching.
  - **Bulk actions:** assign, add to cadence, rescore, export (audited).
  - **Lead page:**
    - timeline, contacts (add and edit), signals, deals, tasks, files;
    - tags;
    - stage and owner;
    - re-enrich;
    - GDPR export and erase.
  - **Import:** a 4-step wizard with duplicate detection and undo within 24 h.
- **Missing:**
  - **no "+ New lead"** (leads come only from import, inbound or list build);
  - **no delete or archive**;
  - company fields can't be edited (name, industry, phone, domain, address, list);
  - contacts can't be deleted;
  - notes can't be edited or deleted;
  - no bulk stage change;
  - no saved views;
  - no metrics strip;
  - search doesn't match contact names;
  - the stage select isn't permission-gated;
  - the timeline filter has no Email or Meeting types.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Lead (company) | **"+ New lead"** form: company, phone, website, country, city, industry, list, brand, contact (optional); duplicate check before saving | DataTable + saved views + Ctrl K; lead page | **Edit every company field inline** in the header; stage (permission-checked); owner; list; brand interest; tags; custom fields | **Archive** (out of every queue, restorable); **merge duplicates** (choose the surviving values); GDPR erase (exists) |
| Contact | Exists | Contacts tab | Exists; plus LinkedIn URL and preferred channel | **Delete** (with undo); move to another company |
| Note | Exists | Timeline | **Edit your own** (15 min), pin to the top | **Delete your own**; founders any |
| Signal | Re-enrich (exists) | Signals tab | — | Dismiss a wrong signal (rescores) |

**Views and sub-pages**
- **`/leads`:** metrics strip:
  - total in view;
  - tier A/B ready to call;
  - untouched > 14 days;
  - no phone / invalid;
  - duplicates found.
  - Saved views:
    - "My A/B leads";
    - "Untouched";
    - "Callbacks this week";
    - "Opted out";
    - "Needs enrichment".
- **`/leads/:id`:** the standard record page, with every company field editable in the property row. Add a **"Next step"** card.
- **`/leads/import`:** exists. Add saved mapping templates per source and more countries.
- **`/leads/duplicates`:** suspected duplicate pairs with a side-by-side merge.
- **`/leads/lists`:** list builds and sources per list:
  - Places, Companies House, CSV;
  - schedule and caps;
  - yield (A/B per 100);
  - this moves from Settings › Jobs.

**Bulk:** stage, tags, list, archive, delete (founders) and export, in addition to what exists.

**Metrics:** leads by tier; A/B ready vs the queue's needs for the next 5 days; contact rate; duplicates.

**Automations**
- **Nightly:** rescore and retention (exists).
- **Untouched A-tier for 7 days:** flagged to the owner.
- **Inbound converted:** the lead goes into the right list and cadence.
- **Duplicate detected on create or import:** blocked, with "open existing".

**Integrations:**
- **Lead sources:** Places, Companies House, Zefix, planning portals, Apollo CSV.
- **Enrichment:** website audit (exists); email verification.
- **Opt-out list:** checked on every write.

**Priority**
- **P0:** "+ New lead"; edit company fields; archive; delete contact; edit and delete notes; permission on stage.
- **P1:** saved views; metrics strip; contact-name search; duplicates and merge.
- **P2:** lists page; import mapping templates.
