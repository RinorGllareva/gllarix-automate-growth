-- M4: meetings with approval, deals (pipeline), commissions (meeting bonus), month close, daily BDR reports.

create type public.deal_stage as enum ('qualified', 'meeting_booked', 'meeting_held', 'opportunity', 'proposal_sent', 'negotiation', 'won', 'lost');

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  booked_by uuid not null references public.users (id),
  owner_id uuid references public.users (id),
  scheduled_at timestamptz not null,
  with_whom text not null,
  type text not null default 'video' check (type in ('video', 'phone', 'in_person')),
  attended boolean,
  approved boolean,
  approval_checklist jsonb not null default '{}',
  approved_by uuid references public.users (id),
  decided_at timestamptz,
  reject_reason text,
  duration_min integer,
  recording_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Approve only when every one of the 6 checks is true (08_MEETINGS.md).
  constraint approve_needs_all_checks check (
    approved is distinct from true or (
      (approval_checklist ->> 'icp')::boolean and (approval_checklist ->> 'contact')::boolean and
      (approval_checklist ->> 'need')::boolean and (approval_checklist ->> 'decision_maker')::boolean and
      (approval_checklist ->> 'held')::boolean and (approval_checklist ->> 'not_duplicate')::boolean
    )
  ),
  constraint reject_needs_reason check (approved is distinct from false or length(coalesce(reject_reason, '')) > 0)
);
create index meetings_scheduled_idx on public.meetings (scheduled_at);
create index meetings_booked_by_idx on public.meetings (booked_by, created_at);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  brand text not null check (brand in ('gllarix', 'arcadian')),
  stage public.deal_stage not null default 'qualified',
  market text not null check (market in ('us', 'we', 'ch', 'xk')),
  currency text not null check (currency in ('USD', 'EUR')),
  setup_minor integer not null default 0,
  monthly_minor integer not null default 0,
  first_year_minor integer,
  pilot boolean not null default false,
  discount_pct numeric(4, 1) not null default 0,
  items text[] not null default '{}',
  owner_id uuid references public.users (id),
  stage_changed_at timestamptz not null default now(),
  expected_close_at timestamptz,
  won_at timestamptz,
  won_override_reason text,
  deposit_paid boolean not null default false,
  lost_reason text,
  lost_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint won_needs_deposit_or_override check (stage <> 'won' or deposit_paid or length(coalesce(won_override_reason, '')) > 0),
  constraint lost_needs_reason check (stage <> 'lost' or length(coalesce(lost_reason, '')) > 0)
);
create index deals_stage_idx on public.deals (stage, owner_id);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  meeting_id uuid references public.meetings (id) on delete set null,
  deal_id uuid references public.deals (id) on delete set null,
  type text not null check (type in ('meeting_bonus', 'setup_commission', 'recurring_commission', 'quarter_bonus')),
  amount_minor integer not null,
  currency text not null check (currency in ('USD', 'EUR')),
  status text not null default 'pending' check (status in ('pending', 'earned', 'paid', 'clawed_back', 'void')),
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now(),
  unique (meeting_id, type)
);

create table public.closed_months (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  closed_by uuid references public.users (id),
  closed_at timestamptz not null default now()
);

create table public.daily_reports (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Approvals can't change once their month is closed.
create function public.guard_closed_month() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.closed_months where month = to_char(old.scheduled_at at time zone 'UTC', 'YYYY-MM'))
     and (new.approved is distinct from old.approved or new.attended is distinct from old.attended) then
    raise exception 'That month is closed';
  end if;
  new.updated_at = now();
  return new;
end
$$;
create trigger meetings_closed_month before update on public.meetings for each row execute function public.guard_closed_month();

-- Only admins decide approvals; BDRs may only mark held / no-show on their own meetings.
create function public.guard_meeting_approval() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.approved is distinct from old.approved or new.approval_checklist is distinct from old.approval_checklist) and not public.is_admin() then
    raise exception 'Only admins approve meetings';
  end if;
  return new;
end
$$;
create trigger meetings_guard_approval before update on public.meetings for each row execute function public.guard_meeting_approval();

-- BDRs can move deals only up to Proposal sent (and to Lost); Won and later stages are admin-only.
create function public.guard_deal_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage and not public.is_admin()
     and new.stage in ('negotiation', 'won') then
    raise exception 'BDRs can move deals up to Proposal sent';
  end if;
  new.updated_at = now();
  if new.stage is distinct from old.stage then new.stage_changed_at = now(); end if;
  return new;
end
$$;
create trigger deals_guard_stage before update on public.deals for each row execute function public.guard_deal_stage();

alter table public.meetings enable row level security;
alter table public.deals enable row level security;
alter table public.commissions enable row level security;
alter table public.closed_months enable row level security;
alter table public.daily_reports enable row level security;

create policy meetings_read on public.meetings for select to authenticated
  using (public.is_admin() or booked_by = public.current_atlas_user_id() or owner_id = public.current_atlas_user_id());
create policy meetings_insert on public.meetings for insert to authenticated
  with check (booked_by = public.current_atlas_user_id() and exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));
create policy meetings_update on public.meetings for update to authenticated
  using (public.is_admin() or booked_by = public.current_atlas_user_id() or owner_id = public.current_atlas_user_id());

-- Viewers see the pipeline read-only; BDRs their own deals.
create policy deals_read on public.deals for select to authenticated
  using (public.current_atlas_role() in ('admin', 'viewer') or owner_id = public.current_atlas_user_id());
create policy deals_write on public.deals for all to authenticated
  using (public.is_admin() or (public.current_atlas_role() in ('bdr', 'closer') and owner_id = public.current_atlas_user_id()))
  with check (public.is_admin() or (public.current_atlas_role() in ('bdr', 'closer') and owner_id = public.current_atlas_user_id()));

-- Commissions: own rows, admins all; only admins (and server jobs) write.
create policy commissions_read on public.commissions for select to authenticated
  using (public.is_admin() or user_id = public.current_atlas_user_id());
create policy commissions_admin on public.commissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy closed_months_read on public.closed_months for select to authenticated using (public.current_atlas_user_id() is not null);
create policy closed_months_admin on public.closed_months for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy daily_reports_read on public.daily_reports for select to authenticated
  using (public.is_admin() or user_id = public.current_atlas_user_id());

/* down:
drop table public.daily_reports, public.closed_months, public.commissions, public.deals, public.meetings cascade;
drop function public.guard_deal_stage(), public.guard_meeting_approval(), public.guard_closed_month();
drop type public.deal_stage;
*/
