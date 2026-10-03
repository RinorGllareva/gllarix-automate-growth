# Growth › Marketing (`/marketing`)

**Job**
- **Founders:** run small, budgeted tests with a stop rule; keep the message consistent.
- **Sellers:** copy the approved messaging and objection answers.

**Who:**
- Founders: edit.
- Sellers: read.

## Today (audit 2026-10-03)
- **Works:**
  - 5 KPIs;
  - positioning;
  - claim checker;
  - inbound channels (status editable);
  - tests (create and update);
  - outbound lists;
  - messaging kit with copy buttons;
  - objections.
- **Missing:**
  - tests and channels can't be deleted;
  - channels can't be added;
  - channel note, owner and due date can't be edited;
  - positioning, messaging and objections live in code;
  - "Edit the cadences" goes to Settings instead of Growth;
  - no content calendar;
  - no spend tracking linked to Finance;
  - no attribution.

## Must-have functionality
| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Channel | **"+ Channel"** (Google profile, referrals, LinkedIn content, local SEO, ads, partners, events) | Table: status, owner, cost/month, leads, meetings, clients, CAC | Status, owner, due, note, budget | Archive |
| Test (experiment) | Exists | Cards | Exists + **result and decision** (scale / stop / iterate), linked spend | Delete a draft; archive finished |
| Message asset | **"+ Asset"**: positioning line, one-liner, email snippet, objection answer, case study, proof point, banned phrase | Messaging kit (exists) with search | **Edit in Atlas** (founders), approve → appears in the call workspace and cadences | Retire |
| Content item | "+ Post / video / case study" | **Content calendar** (month view) | Status (idea → draft → scheduled → published), owner, channel, link | Delete |
| Campaign UTM | "+ Link" → generates a UTM link per channel | Links with clicks → inbound requests | — | Delete |

**Views and sub-pages**
- **`/marketing`:** overview with KPIs (spend this month, inbound requests, cost per inbound, meetings from marketing, CAC).
- **`/marketing/channels`:** the channel table.
- **`/marketing/tests`:** experiments with a budget burn bar and the stop rule.
- **`/marketing/kit`:** messaging and objections. This is where the scripts' answers live (shared with Training).
- **`/marketing/calendar`:** content calendar.
- **`/marketing/attribution`:** source → lead → meeting → client → MRR per channel.

**Automations**
- **A test hits its stop rule:** alert, and propose "Stop" in "Needs a founder".
- **A channel's spend is logged in Finance:** it links here automatically (category marketing + channel tag).
- **A new client from a channel:** CAC is recalculated.

**Integrations:** Google Business Profile (reviews, calls); ad accounts (Google and Meta) for spend via CSV first; website analytics (UTM); LinkedIn (manual).

**Priority**
- **P0:** add, edit and delete channels; delete tests; messaging editable in Atlas.
- **P1:** test results and decisions; spend linked to Finance; attribution.
- **P2:** content calendar; UTM builder.
