# Admin › Integrations
**Route:** `/admin/integrations`

## Content
One card per integration: status (connected / error / off), account, last sync, and Test and Disconnect buttons.
- Supabase (auth/DB, read-only status)
- Twilio (numbers list with connect rate and spam-label check)
- Voice platform (Retell or Vapi)
- Stripe (test/live mode, webhook status)
- Google Workspace (sending inboxes with daily limits and warm-up state)
- Calendar
- Places API and registries (with caps)
- Transcription
- Anthropic API (model per job, monthly cost)
- GitHub (PR status for Codex tasks)
- Sentry

## Rules
- Secrets are never shown after saving (masked), and never stored in the database in plain text.
- Live Stripe mode needs the legal entity flag set in Settings.

## Acceptance
- [ ] Each card's Test button checks the connection and shows the result
- [ ] Number health shows the connect rate per caller ID for the last 7 days
