# Work › Docs and wiki (`/docs`, `/docs/:id`)

**Job:** one place for how we work (handbook, playbooks, SOPs, scripts), replacing Notion.
**Who:**
- Everyone reads.
- Everyone except the accountant writes.
- Founders archive and import.

## Today (audit 2026-10-03)
- **Works:**
  - page tree;
  - title search;
  - Markdown editor with preview;
  - icons;
  - nesting;
  - backlinks and subpages;
  - archive;
  - Notion import (re-import updates);
  - "Moving off Notion" checklist.
- **Missing:**
  - search covers titles only;
  - no restore of archived pages;
  - no version history;
  - no reordering (alphabetical only);
  - no export;
  - images aren't imported;
  - no comments;
  - no templates;
  - no sharing of a page outside Atlas;
  - no permissions per page.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Page | New / subpage (exists); **from a template** (SOP, meeting notes, playbook, decision record) | Tree + **full-text search** + recent + favourites | Edit (exists); **drag to reorder and re-parent**; **block editor** (headings, lists, checkboxes, tables, callouts, images, embeds of Atlas records like a live task list); **page permissions** (everyone / founders / a role) | Archive → **Archive view with restore**; delete forever (founders) |
| Version | Saved on every edit | **History** with a diff | **Restore** a version | — |
| Comment | Inline on a block, @mention | Thread on the page | Resolve | Delete your own |
| Image / file | Paste or upload (Supabase Storage); imported from Notion | Inline | Replace | Delete |
| Public link | "Share publicly" (read-only, revocable) | — | — | Revoke |

**Views and sub-pages**
- **`/docs`:** tree, favourites, recent and search.
- **`/docs/:id`:** page, with history, comments, and "Copy link" / "Export as PDF or Markdown".
- **`/docs/templates`:** page templates.
- **`/docs/archive`:** restore.

**Metrics** (admin): pages not updated in 6 months (stale); SOPs without an owner; most-read pages.

**Automations**
- **SOP page not reviewed in 6 months:** task for its owner.
- **A page linked from Ops is archived:** warn.
- **The AI co-founder** reads the docs as its knowledge source. It cites the page in its answers.

**Integrations:** Notion import (exists; add images); Google Drive file embeds; PDF export.

**Priority**
- **P0:** full-text search; archive view and restore; reordering.
- **P1:** version history; templates; images; export.
- **P2:** block editor; comments; page permissions; public links.
