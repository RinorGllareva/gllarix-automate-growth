-- M13: time tracking (A18). time_entries can now link a client, project, lead or deal instead of a task; weekly timesheets
-- (draft → submitted → approved, locked until an admin reopens); cost rates (admin only); time projects; and the Stripe
-- invoice items approved billable hours turn into (the M7 hook). People enter their own time: no idle, activity or screen tracking.

create table public.time_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sub text not null default '',
  kind text not null check (kind in ('arcadian', 'gllarix', 'presale', 'internal')),
  fixed_price_minor bigint,                  -- fixed-price projects; recurring clients use their payments in the period
  currency text not null check (currency in ('USD', 'EUR')),
  client_id uuid references public.clients (id) on delete set null,
  direct_cost_minor bigint not null default 0, -- freelancer, usage
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Entries: a task, or one other link (client / project / lead / deal).
alter table public.time_entries alter column task_id drop not null;
alter table public.time_entries
  add column ended_at timestamptz,
  add column category text,
  add column linked_type text check (linked_type in ('client', 'project', 'lead', 'deal')),
  add column linked_id uuid,
  add column billable boolean not null default false,
  add column rate_minor integer,
  add column currency text check (currency in ('USD', 'EUR')),
  add constraint time_entries_one_link check (task_id is not null or linked_type is not null or category is not null),
  add constraint time_entries_billable_rate check (not billable or rate_minor is not null);
create index time_entries_linked_idx on public.time_entries (linked_type, linked_id);

alter table public.running_timers alter column task_id drop not null;
alter table public.running_timers
  add column linked_type text check (linked_type in ('client', 'project', 'lead', 'deal')),
  add column linked_id uuid,
  add column category text;

create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  week text not null check (week ~ '^\d{4}-W\d{2}$'), -- ISO week, Monday–Sunday in the person's timezone
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved')),
  submitted_at timestamptz,
  approved_by uuid references public.users (id),
  approved_at timestamptz,
  comment text,                                         -- admin's reason when reopening
  unique (user_id, week),
  -- Another admin approves your week.
  constraint timesheets_not_self_approved check (approved_by is null or approved_by <> user_id)
);

-- Admin only: internal cost per hour, for margins.
create table public.cost_rates (
  user_id uuid not null references public.users (id) on delete cascade,
  hourly_minor integer not null check (hourly_minor >= 0),
  currency text not null check (currency in ('USD', 'EUR')),
  valid_from date not null,
  primary key (user_id, valid_from)
);

create table public.time_invoice_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  timesheet_id uuid not null references public.timesheets (id),
  user_id uuid not null references public.users (id),
  description text not null,
  minutes integer not null check (minutes > 0),
  rate_minor integer not null,
  amount_minor bigint not null,
  currency text not null check (currency in ('USD', 'EUR')),
  stripe_item_id text not null unique,                  -- Stripe invoice item (test mode until go-live)
  status text not null default 'pending' check (status in ('pending', 'invoiced')),
  invoice_id uuid references public.invoices (id),
  created_at timestamptz not null default now()
);
create index time_invoice_items_client_idx on public.time_invoice_items (client_id, status);

-- A week is locked once submitted: no entry in it can be added, changed or removed until an admin reopens it.
create function public.week_locked(p_user uuid, p_at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.timesheets t join public.users u on u.id = t.user_id
    where t.user_id = p_user and t.status <> 'draft'
      and t.week = to_char((p_at at time zone u.timezone)::date, 'IYYY-"W"IW')
  );
$$;

create function public.time_entries_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and public.week_locked(old.user_id, old.started_at) then
    raise exception 'That week is submitted or approved. An admin has to reopen it first.';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and public.week_locked(new.user_id, new.started_at) then
    raise exception 'That week is submitted or approved. An admin has to reopen it first.';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger time_entries_lock before insert or update or delete on public.time_entries
  for each row execute function public.time_entries_lock();

-- Reopening withdraws invoice items not yet on an invoice (the Edge Function also deletes them in Stripe).
create function public.timesheet_reopened() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'approved' and new.status = 'draft' then
    delete from public.time_invoice_items where timesheet_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
create trigger timesheet_reopened after update on public.timesheets
  for each row execute function public.timesheet_reopened();

alter table public.time_projects enable row level security;
alter table public.timesheets enable row level security;
alter table public.cost_rates enable row level security;
alter table public.time_invoice_items enable row level security;

-- Entries: your own (task entries keep the M9 task-visibility read); admins see and fix everyone's.
drop policy time_entries_read on public.time_entries;
drop policy time_entries_own on public.time_entries;
create policy time_entries_read on public.time_entries for select to authenticated
  using (user_id = public.current_atlas_user_id() or public.is_admin() or (task_id is not null and public.can_see_task(task_id)));
create policy time_entries_own on public.time_entries for all to authenticated
  using (user_id = public.current_atlas_user_id() or public.is_admin())
  with check ((user_id = public.current_atlas_user_id() or public.is_admin()) and (task_id is null or public.can_see_task(task_id)));

create policy time_projects_read on public.time_projects for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy time_projects_admin on public.time_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Timesheets: you submit your own; admins approve (not their own, see the check) and reopen.
create policy timesheets_read on public.timesheets for select to authenticated using (user_id = public.current_atlas_user_id() or public.is_admin());
create policy timesheets_submit on public.timesheets for insert to authenticated
  with check (user_id = public.current_atlas_user_id() and status in ('draft', 'submitted') and approved_by is null);
create policy timesheets_submit_update on public.timesheets for update to authenticated
  using (user_id = public.current_atlas_user_id() and status = 'draft')
  with check (user_id = public.current_atlas_user_id() and status in ('draft', 'submitted') and approved_by is null);
create policy timesheets_admin on public.timesheets for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cost_rates_admin on public.cost_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Invoice items are written by the approve Edge Function (service role); admins read them.
create policy time_invoice_items_admin_read on public.time_invoice_items for select to authenticated using (public.is_admin());

-- Reports: the implementer gets hours only. Money columns come from report functions that check is_admin();
-- cost_rates and invoice amounts are never readable by other roles.
