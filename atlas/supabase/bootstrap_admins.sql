-- Run once, after the migrations, in the Supabase SQL editor.
-- Replace the placeholders with the two founders' real work emails (lower case), then run.
-- Afterwards invite the same emails from Authentication → Users → Invite user;
-- the trigger links each account to its Atlas profile.

insert into public.users (name, email, role, timezone, daily_capacity) values
  ('Rinor', '[RINOR WORK EMAIL]', 'admin', 'Europe/Belgrade', null),
  ('Artin', '[CO-FOUNDER WORK EMAIL]', 'admin', 'Europe/Belgrade', 80)
on conflict (email) do nothing;

select public.link_existing_auth_users();
