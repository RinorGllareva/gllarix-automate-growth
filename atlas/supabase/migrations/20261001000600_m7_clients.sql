-- M7: clients onboarding, Stripe subscriptions, usage (daily + monthly), invoices, monthly client reports, client tasks.
-- Jobs (usage import, month-end invoices + reports, health tasks) run as Edge Functions on pg_cron with the service role.

alter table public.clients add column onboarding jsonb not null default '[]';

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  currency text not null check (currency in ('USD', 'EUR')),
  market text not null check (market in ('us', 'we', 'ch', 'xk')),
  monthly_minor integer not null check (monthly_minor >= 0),
  list_monthly_minor integer not null check (list_monthly_minor >= monthly_minor),
  included_minutes integer not null default 0 check (included_minutes >= 0),
  overage_rate_minor numeric(8, 2) not null check (overage_rate_minor >= 0),
  billing text not null default 'monthly' check (billing in ('monthly', 'annual')),
  pilot boolean not null default false,
  free_until timestamptz,
  pilot_until timestamptz,
  prepaid_until timestamptz,
  voice_account_id text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'canceled')),
  started_at timestamptz not null,
  paused_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Pilot: first month free, pilot rate for 12 months (context/02).
  constraint pilot_terms check (not pilot or (free_until is not null and pilot_until is not null))
);

-- Daily usage from the voice platform (UsagePortal); one row per client per day.
create table public.usage_daily (
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  minutes integer not null check (minutes >= 0),
  calls integer not null default 0,
  after_hours integer not null default 0,
  booked integer not null default 0,
  missed integer not null default 0,
  cost_minor integer not null default 0,
  imported_at timestamptz not null default now(),
  primary key (client_id, date)
);

-- A closed month: overage = max(0, minutes − included) × rate.
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  minutes_used integer not null,
  calls_count integer not null,
  included_minutes integer not null,
  overage_minutes integer generated always as (greatest(0, minutes_used - included_minutes)) stored,
  overage_minor integer not null,
  cost_minor integer not null,
  source text not null check (source in ('fake_portal', 'voice_platform')),
  created_at timestamptz not null default now(),
  unique (client_id, period)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  deal_id uuid not null references public.deals (id),
  period text not null check (period ~ '^\d{4}-\d{2}$' or period = 'go-live'),
  lines jsonb not null,
  total_minor integer not null,
  currency text not null check (currency in ('USD', 'EUR')),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  stripe_invoice_id text not null unique,
  issued_at timestamptz not null,
  due_at timestamptz not null,
  paid_at timestamptz,
  unique (client_id, period)
);

alter table public.payments add column invoice_id uuid references public.invoices (id);

create table public.client_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  token text not null unique,
  kpis jsonb not null,
  email_id uuid,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.users (id)
);

-- Until Tasks (M9): health calls, number release and data export after a cancel.
create table public.client_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null check (type in ('health_call', 'number_release', 'export_data')),
  title text not null,
  assignee_id uuid references public.users (id),
  due_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index client_tasks_one_open_health_call on public.client_tasks (client_id) where type = 'health_call' and done_at is null;

-- Recurring commission: at most 6 monthly payments per deal (10% of monthly for 6 months).
create function public.guard_recurring_commission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'recurring_commission'
     and (select count(*) from public.commissions c where c.deal_id = new.deal_id and c.type = 'recurring_commission') >= 6 then
    raise exception 'Recurring commission covers the first 6 monthly payments only';
  end if;
  return new;
end
$$;
create trigger commissions_recurring_cap before insert on public.commissions for each row execute function public.guard_recurring_commission();

-- Who sees a client: admins, implementers and viewers all; BDRs/closers the clients from their own deals (read-only).
create function public.can_see_client(p_deal_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_atlas_role() in ('admin', 'implementer', 'viewer')
      or exists (select 1 from public.deals d where d.id = p_deal_id and d.owner_id = public.current_atlas_user_id());
$$;

alter table public.subscriptions enable row level security;
alter table public.usage_daily enable row level security;
alter table public.usage_records enable row level security;
alter table public.invoices enable row level security;
alter table public.client_reports enable row level security;
alter table public.client_tasks enable row level security;

-- Clients: BDRs/closers read their own (M6 policy covered admin/implementer/viewer).
drop policy clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.can_see_client(deal_id));
create policy clients_onboarding on public.clients for update to authenticated
  using (public.current_atlas_role() = 'implementer' and status = 'onboarding');

-- Finance (subscriptions, invoices): not for the implementer.
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (public.current_atlas_role() <> 'implementer' and exists (select 1 from public.clients c where c.id = client_id and public.can_see_client(c.deal_id)));
create policy subscriptions_admin on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy invoices_read on public.invoices for select to authenticated
  using (public.current_atlas_role() <> 'implementer' and public.can_see_client(deal_id));

-- Usage minutes and reports: everyone who sees the client. Our cost per minute is served by an admin-only view below.
create policy usage_daily_read on public.usage_daily for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and public.can_see_client(c.deal_id)));
create policy usage_records_read on public.usage_records for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and public.can_see_client(c.deal_id)));
create policy client_reports_read on public.client_reports for select to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and public.can_see_client(c.deal_id)));
create policy client_reports_send on public.client_reports for insert to authenticated
  with check (public.current_atlas_role() in ('admin', 'implementer') and sent_by = public.current_atlas_user_id());

create policy client_tasks_read on public.client_tasks for select to authenticated
  using (public.is_admin() or assignee_id = public.current_atlas_user_id() or public.current_atlas_role() = 'implementer');
create policy client_tasks_done on public.client_tasks for update to authenticated
  using (public.is_admin() or assignee_id = public.current_atlas_user_id());

-- The implementer and BDRs never see our usage cost: expose minutes without cost_minor to them.
-- (A column REVOKE doesn't override a table grant, so grant the readable columns explicitly.)
revoke select on public.usage_daily, public.usage_records from authenticated, anon;
grant select (client_id, date, minutes, calls, after_hours, booked, missed, imported_at) on public.usage_daily to authenticated;
grant select (id, client_id, period, minutes_used, calls_count, included_minutes, overage_minutes, overage_minor, source, created_at) on public.usage_records to authenticated;
create view public.client_costs with (security_invoker = false) as
  select client_id, period, cost_minor from public.usage_records where public.is_admin();

/* down:
drop view public.client_costs;
drop trigger commissions_recurring_cap on public.commissions;
drop function public.guard_recurring_commission();
drop table public.client_tasks, public.client_reports, public.invoices, public.usage_records, public.usage_daily, public.subscriptions cascade;
alter table public.payments drop column invoice_id;
drop policy clients_read on public.clients;
drop policy clients_onboarding on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.current_atlas_role() in ('admin', 'implementer', 'viewer'));
drop function public.can_see_client(uuid);
alter table public.clients drop column onboarding;
*/
