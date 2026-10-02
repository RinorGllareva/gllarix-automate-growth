-- M1 leads data model (CRM_BUILD_PROMPT A6) with row-level security.
-- Admins see everything; BDRs and closers see only leads they own (and the companies, contacts,
-- signals and activities behind them); implementers and viewers see no leads.

create extension if not exists pg_trgm with schema extensions;

create type public.list_type as enum ('trades', 'developers');
create type public.lead_stage as enum ('new', 'researched', 'contacted', 'replied', 'qualified', 'meeting_booked',
  'meeting_completed', 'opportunity', 'proposal_sent', 'negotiation', 'won', 'lost', 'nurture');
create type public.lead_tier as enum ('A', 'B', 'C', 'D');
create type public.suppression_type as enum ('email', 'phone', 'domain');
create type public.suppression_reason as enum ('opt_out', 'do_not_call', 'complaint', 'legal');

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null,
  country text,
  cost_per_record_minor integer not null default 0,
  terms_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  domain text,
  phone_e164 text,
  country text,
  region text,
  city text,
  timezone text,
  industry text,
  list_type public.list_type not null,
  brand_interest text[] not null default '{}',
  employees_est integer,
  reviews_count integer,
  rating numeric(2, 1),
  website_status text,
  source_id uuid references public.sources (id),
  external_ids jsonb not null default '{}',
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Exact duplicates are impossible: one company per phone and per domain.
create unique index companies_phone_uniq on public.companies (phone_e164) where phone_e164 is not null;
create unique index companies_domain_uniq on public.companies (domain) where domain is not null;
create index companies_name_trgm on public.companies using gin (name extensions.gin_trgm_ops);
create index companies_country_idx on public.companies (country);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  title text,
  email text,
  email_status text not null default 'unknown' check (email_status in ('valid', 'invalid', 'unknown')),
  phone_e164 text,
  phone_type text not null default 'unknown' check (phone_type in ('mobile', 'landline', 'unknown')),
  phone_verified boolean not null default false,
  phone_invalid boolean not null default false,
  linkedin_url text,
  is_decision_maker boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_company_idx on public.contacts (company_id);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id),
  file_name text not null,
  created_by uuid references public.users (id),
  rows integer not null default 0,
  created integer not null default 0,
  merged integer not null default 0,
  skipped integer not null default 0,
  suppressed integer not null default 0,
  failed integer not null default 0,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  primary_contact_id uuid references public.contacts (id) on delete set null,
  owner_id uuid references public.users (id) on delete set null,
  list_type public.list_type not null,
  stage public.lead_stage not null default 'new',
  score smallint not null default 0 check (score between 0 and 100),
  tier public.lead_tier not null default 'D',
  score_breakdown jsonb not null default '[]',
  score_model_version text,
  scored_at timestamptz,
  excluded boolean not null default false,
  suppressed boolean not null default false,
  next_action_at timestamptz,
  next_action_type text,
  cadence_id uuid,
  cadence_step smallint,
  attempts_count smallint not null default 0,
  last_touch_at timestamptz,
  status_reason text,
  lawful_basis text not null default 'Legitimate interest · B2B',
  lawful_basis_note text,
  import_id uuid references public.imports (id) on delete set null,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_tier_idx on public.leads (tier, score desc);
create index leads_stage_idx on public.leads (stage);
create index leads_owner_idx on public.leads (owner_id);
create index leads_next_action_idx on public.leads (next_action_at);
create index leads_import_idx on public.leads (import_id);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  key text not null,
  value jsonb not null,
  source text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz
);
create index signals_lead_idx on public.signals (lead_id);

create table public.score_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  score smallint not null,
  tier public.lead_tier not null,
  model_version text not null,
  breakdown jsonb not null,
  computed_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  user_id uuid references public.users (id),
  type text not null,
  direction text,
  disposition text,
  title text not null,
  detail text,
  duration_s integer,
  recording_url text,
  transcript_url text,
  summary text,
  payload jsonb not null default '{}',
  at timestamptz not null default now()
);
create index activities_lead_idx on public.activities (lead_id, at desc);

-- Queue tasks (one row per queued call/email). M9's task manager owns the name public.tasks.
create table public.queue_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id),
  lead_id uuid references public.leads (id) on delete cascade,
  type text not null check (type in ('call', 'email', 'linkedin', 'follow_up', 'meeting_prep')),
  due_at timestamptz not null,
  window_start time,
  window_end time,
  priority numeric not null default 0,
  status text not null default 'open' check (status in ('open', 'done', 'skipped', 'cancelled')),
  queue_date date,
  source text not null default 'manual' check (source in ('queue', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index queue_tasks_owner_queue_idx on public.queue_tasks (owner_id, queue_date);

create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  value text not null,
  type public.suppression_type not null,
  reason public.suppression_reason not null,
  source text not null check (source in ('call_outcome', 'unsubscribe', 'manual', 'import')),
  added_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique (type, value)
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Access helpers ------------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_atlas_role() = 'admin', false)
$$;

create function public.can_see_lead(p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.current_atlas_role() in ('bdr', 'closer') and p_owner = public.current_atlas_user_id())
$$;

create function public.can_see_company(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.leads l where l.company_id = p_company and public.can_see_lead(l.owner_id)
  )
$$;

/** Suppression is checked server-side for everyone, without exposing the list itself. */
create function public.is_suppressed(p_phone text, p_email text, p_domain text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.suppression_list s
    where (s.type = 'phone' and s.value = p_phone)
       or (s.type = 'email' and s.value = lower(p_email))
       or (s.type = 'domain' and (s.value = lower(p_domain) or s.value = split_part(lower(p_email), '@', 2)))
  )
$$;

-- Only admins change a lead's owner (BDRs may update stage and next action on their own leads).
create function public.guard_lead_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is distinct from old.owner_id and not public.is_admin() then
    raise exception 'Only admins change lead owners';
  end if;
  new.updated_at = now();
  return new;
end
$$;
create trigger leads_guard_owner before update on public.leads for each row execute function public.guard_lead_owner();

-- Audit every lead change with before/after.
create function public.audit_lead_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (user_id, action, entity, entity_id, before, after)
  values (public.current_atlas_user_id(), 'lead.' || lower(tg_op), 'lead', coalesce(new.id, old.id),
          case when tg_op <> 'INSERT' then jsonb_build_object('stage', old.stage, 'owner_id', old.owner_id, 'tier', old.tier, 'score', old.score) end,
          case when tg_op <> 'DELETE' then jsonb_build_object('stage', new.stage, 'owner_id', new.owner_id, 'tier', new.tier, 'score', new.score) end);
  return coalesce(new, old);
end
$$;
create trigger leads_audit after insert or update or delete on public.leads for each row execute function public.audit_lead_change();

-- RLS ------------------------------------------------------------------------------------------

alter table public.sources enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.imports enable row level security;
alter table public.leads enable row level security;
alter table public.signals enable row level security;
alter table public.score_history enable row level security;
alter table public.activities enable row level security;
alter table public.queue_tasks enable row level security;
alter table public.suppression_list enable row level security;
alter table public.settings enable row level security;

create policy sources_read on public.sources for select to authenticated using (public.current_atlas_role() in ('admin', 'bdr', 'closer'));
create policy sources_admin on public.sources for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy leads_read on public.leads for select to authenticated using (public.can_see_lead(owner_id));
create policy leads_update on public.leads for update to authenticated using (public.can_see_lead(owner_id)) with check (public.can_see_lead(owner_id));
create policy leads_admin_insert on public.leads for insert to authenticated with check (public.is_admin());
create policy leads_admin_delete on public.leads for delete to authenticated using (public.is_admin());

create policy companies_read on public.companies for select to authenticated using (public.can_see_company(id));
create policy companies_update on public.companies for update to authenticated using (public.can_see_company(id)) with check (public.can_see_company(id));
create policy companies_admin_insert on public.companies for insert to authenticated with check (public.is_admin());
create policy companies_admin_delete on public.companies for delete to authenticated using (public.is_admin());

create policy contacts_read on public.contacts for select to authenticated using (public.can_see_company(company_id));
create policy contacts_write on public.contacts for all to authenticated using (public.can_see_company(company_id)) with check (public.can_see_company(company_id));

create policy signals_read on public.signals for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));
create policy signals_admin on public.signals for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy score_history_read on public.score_history for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));

create policy activities_read on public.activities for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));
create policy activities_insert on public.activities for insert to authenticated
  with check (user_id = public.current_atlas_user_id()
              and exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));

create policy queue_tasks_own on public.queue_tasks for all to authenticated
  using (public.is_admin() or owner_id = public.current_atlas_user_id())
  with check (public.is_admin() or owner_id = public.current_atlas_user_id());

create policy imports_admin on public.imports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy suppression_admin on public.suppression_list for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

/* down:
drop table public.settings, public.suppression_list, public.queue_tasks, public.activities, public.score_history,
  public.signals, public.leads, public.imports, public.contacts, public.companies, public.sources cascade;
drop function public.audit_lead_change(), public.guard_lead_owner(), public.is_suppressed(text, text, text),
  public.can_see_company(uuid), public.can_see_lead(uuid), public.is_admin();
drop type public.suppression_reason, public.suppression_type, public.lead_tier, public.lead_stage, public.list_type;
*/
