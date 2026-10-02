# 01 — Sign in
**Route:** `/login` (public) · **Mockup:** `Login.dc.html` · **Milestone:** M0 · **Roles:** everyone (signed out)

## Purpose
Secure access for invited users only, via Supabase Auth.

## Layout
- Full-bleed deep background (`--bg-deep`) with the flowing-line SVG (decorative, `aria-hidden`).
- **Top left:** brand mark + ATLAS.
- **Left column:**
  - label "SALES OPERATIONS · ARCADIAN × GLLARIX";
  - headline "Every lead." (300) / "On the dot." (600, ice);
  - one-line description.
- **Right card (400 px):** the sign-in form.

## Form
| Field | Rules |
|---|---|
| Work email | Required, email format, lower-cased |
| Password | Required; show/hide toggle |
| SIGN IN (primary) | Submits to Supabase; on success → `/today` (or the `next` URL if safe and internal) |
| EMAIL ME A MAGIC LINK (secondary) | Sends a magic link; shows "Check your inbox" |
| Footer | "Access is by invite. Ask an admin to add you." |

## Behaviour
- Rate limit: 5 failed attempts per 15 min per email and IP. After that, show "Too many attempts, try again in 15 minutes".
- Errors are generic: "Email or password is wrong" (never reveal whether the account exists).
- Deactivated users: "Your access is paused. Ask an admin."
- Session: secure, httpOnly cookie; 12-hour idle timeout; sign-out clears the session.
- Already signed in → redirect to `/today`.

## Endpoints
`GET /login` · `POST /auth/password` · `POST /auth/magic-link` · `GET /auth/callback` · `POST /auth/logout`

## Acceptance criteria
- [ ] The invited admin and the BDR can sign in; an unknown email gets the generic error
- [ ] The rate limit triggers on the 6th failure
- [ ] An open redirect via `next` is impossible (external URLs are ignored)
- [ ] Every sign-in and sign-out is written to `audit_log`

## Out of scope
Self sign-up, SSO, 2FA (later).
