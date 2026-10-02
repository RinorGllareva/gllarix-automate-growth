-- M8: lead-source connectors with monthly caps, a response cache, a cost ledger, job runs (list build, enrichment).
-- Connectors run in Edge Functions with API keys kept in Supabase secrets (never in these tables).
-- Website audits need a headless browser: a small Playwright worker (not an Edge Function) writes signals with the service role.

create table public.source_connectors (
  id text primary key check (id in ('places_api', 'companies_house', 'zefix', 'csv_template')),
  connected boolean not null default false,
  cap_minor integer not null default 0 check (cap_minor >= 0),
  cost_per_request_minor integer not null default 0,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);
insert into public.source_connectors (id, connected, cap_minor, cost_per_request_minor) values
  ('places_api', false, 5000, 4), ('companies_house', false, 0, 0), ('zefix', false, 0, 0), ('csv_template', true, 0, 0);

-- Cached provider pages. Places content may be cached at most 30 days (place ids indefinitely): a nightly job purges older rows.
create table public.source_cache (
  key text primary key,
  connector text not null references public.source_connectors (id),
  page jsonb not null,
  fetched_at timestamptz not null default now()
);
create index source_cache_fetched_idx on public.source_cache (fetched_at);

create table public.cost_ledger (
  id uuid primary key default gen_random_uuid(),
  connector text not null references public.source_connectors (id),
  at timestamptz not null default now(),
  cost_minor integer not null check (cost_minor >= 0),
  job_run_id uuid,
  note text
);
create index cost_ledger_month_idx on public.cost_ledger (connector, at);

create table public.job_state (
  type text primary key,
  paused boolean not null default false,
  reason text,
  updated_at timestamptz not null default now()
);
insert into public.job_state (type) values ('list_build'), ('enrichment');

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  type text not null references public.job_state (type),
  status text not null check (status in ('running', 'succeeded', 'failed', 'capped')),
  trigger text not null check (trigger in ('shortfall', 'manual', 'retry', 'schedule')),
  started_by uuid references public.users (id),
  owner_id uuid references public.users (id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer not null default 0,
  items integer not null default 0,
  cost_minor integer not null default 0,
  log text[] not null default '{}',
  error text,
  params jsonb not null default '{}',
  retry_of uuid references public.job_runs (id)
);
create index job_runs_type_idx on public.job_runs (type, started_at desc);
alter table public.cost_ledger add constraint cost_ledger_run_fk foreign key (job_run_id) references public.job_runs (id);

-- Where each search plan continues (next page cursor; 'done' when exhausted).
create table public.search_plan_cursors (
  plan_id text primary key,
  cursor text,
  updated_at timestamptz not null default now()
);

-- Dedup on provider ids: one company per Places place_id / registry number.
create index companies_external_ids_idx on public.companies using gin (external_ids);

-- Spend this month per connector; the Edge Function refuses a paid request that would pass the cap.
create function public.connector_spend(p_connector text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_minor), 0)::integer from public.cost_ledger
  where connector = p_connector and at >= date_trunc('month', now());
$$;

alter table public.source_connectors enable row level security;
alter table public.source_cache enable row level security;
alter table public.cost_ledger enable row level security;
alter table public.job_state enable row level security;
alter table public.job_runs enable row level security;
alter table public.search_plan_cursors enable row level security;

-- Admins only; jobs write with the service role.
create policy source_connectors_admin on public.source_connectors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cost_ledger_admin on public.cost_ledger for select to authenticated using (public.is_admin());
create policy job_state_admin on public.job_state for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy job_runs_admin on public.job_runs for select to authenticated using (public.is_admin());
-- source_cache and search_plan_cursors: service role only (no policies).

/* down:
drop function public.connector_spend(text);
drop index public.companies_external_ids_idx;
drop table public.search_plan_cursors, public.cost_ledger, public.job_runs, public.job_state, public.source_cache, public.source_connectors cascade;
*/
