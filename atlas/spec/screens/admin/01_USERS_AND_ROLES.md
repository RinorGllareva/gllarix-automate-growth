# Admin › Users and roles
**Route:** `/admin/users`

## Content
- **Table:** name · email · role (admin, bdr, closer, implementer, viewer) · timezone · daily capacity · status (active / paused) · last sign-in.
- **INVITE USER:** email, name, role, timezone, capacity (BDR 150, co-founder 80 by default); sends a Supabase invite.

## Actions
- Edit role, timezone and capacity.
- Pause or reactivate (paused users can't sign in, and their queue tasks are reassigned to a chosen person).
- Reset the password link.

## Rules
- At least one active admin must remain.
- Role changes take effect at the next request.
- Capacity feeds the queue builder and Today.

## Acceptance
- [ ] An invited user can sign in with the right role
- [ ] Pausing a user reassigns their open tasks
- [ ] The last admin can't be demoted
