-- Calendar: each person connects their own Google Calendar. The "google-calendar" Edge Function runs the OAuth flow
-- (scope calendar.events + freebusy; client id/secret are Supabase secrets), keeps the refresh token server-side, pushes
-- Atlas meetings and callbacks as events and reads busy time back. Staff email alerts (meetings, callbacks, urgent tasks)
-- go out from the "alerts" job on pg_cron, once each, per each person's settings.

create table public.calendar_connections (
  user_id uuid primary key references public.users (id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  google_email text not null,
  calendar_id text not null default 'primary',
  status text not null default 'connected' check (status in ('connected', 'error')),
  -- Only the Edge Function (service role) reads these; see the column grants below.
  refresh_token text,
  sync_token text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

-- Which Atlas item each pushed Google event belongs to ("meeting:<id>", "callback:<lead id>").
create table public.calendar_event_links (
  user_id uuid not null references public.users (id) on delete cascade,
  atlas_ref text not null,
  google_event_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, atlas_ref)
);

-- The person's own Google events, read back as busy blocks (title shown only to them).
create table public.calendar_busy (
  user_id uuid not null references public.users (id) on delete cascade,
  google_event_id text not null,
  title text not null default 'Busy',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  primary key (user_id, google_event_id)
);

create table public.notification_prefs (
  user_id uuid primary key references public.users (id) on delete cascade,
  email jsonb not null default '{"meeting_booked": true, "meeting_soon": true, "callback_due": true, "task_urgent": true, "task_overdue": true}',
  calendar_prompt_dismissed_at timestamptz
);

-- Alert emails to team members (not prospects). key makes each alert send once.
create table public.staff_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  to_email text not null,
  type text not null check (type in ('meeting_booked', 'meeting_soon', 'callback_due', 'task_urgent', 'task_overdue')),
  subject text not null,
  body text not null,
  href text,
  key text not null unique,
  sent_at timestamptz not null default now()
);
create index staff_emails_user_idx on public.staff_emails (user_id, sent_at desc);

alter table public.calendar_connections enable row level security;
alter table public.calendar_event_links enable row level security;
alter table public.calendar_busy enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.staff_emails enable row level security;

create policy calendar_connections_own on public.calendar_connections for select to authenticated using (user_id = public.current_atlas_user_id());
create policy calendar_connections_delete on public.calendar_connections for delete to authenticated using (user_id = public.current_atlas_user_id());
-- Tokens never reach the browser, even for the owner.
revoke select on public.calendar_connections from authenticated;
grant select (user_id, provider, google_email, calendar_id, status, connected_at, last_sync_at, last_error) on public.calendar_connections to authenticated;
grant delete on public.calendar_connections to authenticated;

create policy calendar_links_own on public.calendar_event_links for select to authenticated using (user_id = public.current_atlas_user_id() or public.is_admin());
create policy calendar_busy_own on public.calendar_busy for select to authenticated using (user_id = public.current_atlas_user_id() or public.is_admin());
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (user_id = public.current_atlas_user_id()) with check (user_id = public.current_atlas_user_id());
create policy staff_emails_own on public.staff_emails for select to authenticated using (user_id = public.current_atlas_user_id());

-- select cron.schedule('atlas-alerts', '* * * * *', $$select net.http_post(url := '<project>/functions/v1/alerts')$$);
-- select cron.schedule('atlas-calendar-sync', '*/5 * * * *', $$select net.http_post(url := '<project>/functions/v1/google-calendar', body := '{"job":"sync"}')$$);
