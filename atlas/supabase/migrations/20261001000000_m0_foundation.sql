-- M0 foundation: users, audit_log, notifications, with row-level security.
-- Reversible: see the "down" block at the bottom.

create type public.atlas_role as enum ('admin', 'bdr', 'closer', 'implementer', 'viewer');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  email text not null unique check (email = lower(email)),
  role public.atlas_role not null,
  timezone text not null default 'UTC',
  daily_capacity integer check (daily_capacity is null or daily_capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  text text not null,
  href text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Helpers: the signed-in Atlas user and their role (security definer so RLS can call them).
create function public.current_atlas_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_id = auth.uid() and active
$$;

create function public.current_atlas_role() returns public.atlas_role
language sql stable security definer set search_path = public as $$
  select role from public.users where auth_id = auth.uid() and active
$$;

-- Audit writes go through this function so clients can't forge user_id.
create function public.log_audit(p_action text, p_entity text, p_entity_id uuid default null,
                                 p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (user_id, action, entity, entity_id, before, after)
  values (public.current_atlas_user_id(), p_action, p_entity, p_entity_id, p_before, p_after)
$$;

alter table public.users enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

-- users: everyone signed in can see the team list; only admins change it.
create policy users_select on public.users for select to authenticated
  using (public.current_atlas_user_id() is not null);
create policy users_admin_write on public.users for all to authenticated
  using (public.current_atlas_role() = 'admin') with check (public.current_atlas_role() = 'admin');

-- audit_log: admins read; nobody writes directly (log_audit only).
create policy audit_admin_select on public.audit_log for select to authenticated
  using (public.current_atlas_role() = 'admin');

-- notifications: own rows only.
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = public.current_atlas_user_id());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = public.current_atlas_user_id()) with check (user_id = public.current_atlas_user_id());

-- Notifications older than 90 days are deleted by a scheduled job (13_SEARCH_AND_NOTIFICATIONS.md).

/* down:
drop table public.notifications;
drop table public.audit_log;
drop function public.log_audit(text, text, uuid, jsonb, jsonb);
drop function public.current_atlas_role();
drop function public.current_atlas_user_id();
drop table public.users;
drop type public.atlas_role;
*/
