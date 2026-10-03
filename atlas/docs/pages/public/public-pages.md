# Public pages (no sign-in), 6 today

These pages are what clients and prospects see, so they carry the brand: Gllarix or Arcadian, not "Atlas". They work on phones first and in print.

| Page | Today (audit 2026-10-03) | Must have |
|---|---|---|
| **Booking** `/book/:slug` | Pick a slot by day, form, book; promises confirmation and reminders | Reschedule / cancel link in the confirmation; time-zone picker; questions per meeting type; the seller's photo and short bio; Google Meet link created; round-robin booking page for the team |
| **Quote** `/q/:token` | Quote, accept by name + checkbox, pay deposit (test checkout), expired/paid states, print | Real PDF download; "Ask a question" (creates an inbound reply to the owner); option picker (client can toggle pilot / annual within allowed options); expiry countdown; brand per quote |
| **Contract** `/c/:token` | Typed-name signature, signed PDF, SHA-256 | Counter-signature by a founder; download the unsigned draft; decline with a reason; brand legal details filled from Settings |
| **Client report** `/r/:token` | 4 KPIs, minutes per day chart, print | Month picker (all reports); comparison with the previous month; calls answered after hours as "money saved"; NPS question at the bottom |
| **Checkout** `/pay/:id` | Fake test checkout | Replaced by real Stripe Checkout (hosted); this page stays only for the test mode |
| **Unsubscribe** `/u/:token` | One click, handles invalid links | Preference centre (stop marketing, keep invoices and service emails); undo within 10 minutes; confirmation |

**New public pages**
- **`/apply/:opening`:** job application with a voice note (see Hiring).
- **`/support/new`:** support form for clients, matched by email (see Support).
- **`/portal`:** client portal with a magic link (reports, invoices, tickets, files, plan changes).
- **`/status`:** a status page for the receptionist service (optional, later).

**Rules**
- **Every public link is a long random token,** revocable, and expires where it makes sense (quotes, contracts).
- **No sign-in, no passwords and no card details on our pages:** payment always happens on Stripe's hosted page.
- **Rate limiting** applies to every public page.
