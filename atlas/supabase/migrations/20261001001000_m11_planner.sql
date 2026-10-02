-- M11: the AI planner log (plans), automations with task templates, goals, recurring tasks.
-- The planner runs in an Edge Function ("planner") that holds the system prompt and ANTHROPIC_API_KEY as secrets;
-- the browser sends the idea and settings and gets the validated draft back. Nothing is written to tasks before Accept.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('plan', 'split', 'replan', 'weekly')),
  idea text not null,
  settings jsonb not null,
  request_context jsonb not null default '{}',
  response jsonb,
  rows jsonb not null default '[]',
  changes jsonb not null default '[]',
  parent_task_id uuid references public.tasks (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'accepted', 'rejected', 'failed')),
  model text not null,
  cost_minor numeric(10, 2) not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  attempts integer not null default 1,
  errors text[] not null default '{}',
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  accepted_by uuid references public.users (id),
  accepted_at timestamptz
);
create index plans_month_idx on public.plans (created_at);

alter table public.tasks
  add constraint tasks_plan_fk foreign key (plan_id) references public.plans (id) on delete set null;
-- Recurrence as {"freq": "weekly", "interval": 1} replaces m9's free-text recurrence_rule.
alter table public.tasks drop column recurrence_rule, add column recurrence jsonb, add column goal_id uuid;

insert into public.settings (key, value) values ('ai', '{"monthly_cap_eur_minor": 3000, "jobs": {"planner": "claude-sonnet-5-5", "planner_split": "claude-haiku-4-5-20251001"}}')
on conflict (key) do nothing;

-- Month-to-date AI spend in EUR cents (USD costs at the planning rate). The Edge Function refuses new plans at the cap.
create function public.ai_spend_this_month() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_minor), 0) / 1.15 from public.plans where created_at >= date_trunc('month', now());
$$;

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  items jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger jsonb not null,
  conditions jsonb not null default '[]',
  actions jsonb not null,
  active boolean not null default true,
  runs integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  at timestamptz not null default now(),
  event text not null,
  subject text not null,
  result text not null,
  ok boolean not null
);
create index automation_runs_at_idx on public.automation_runs (at desc);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kpi text not null check (kpi in ('mrr_eur', 'paying_clients', 'approved_meetings_month', 'meetings_booked_month', 'won_deals')),
  target numeric not null check (target > 0),
  due_at date not null,
  owner_id uuid references public.users (id),
  created_at timestamptz not null default now()
);
alter table public.tasks add constraint tasks_goal_fk foreign key (goal_id) references public.goals (id) on delete set null;

alter table public.plans enable row level security;
alter table public.task_templates enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.goals enable row level security;

-- Plans: admins see all; others their own. Writes go through the Edge Function (service role).
create policy plans_read on public.plans for select to authenticated using (public.is_admin() or created_by = public.current_atlas_user_id());
create policy plans_own_update on public.plans for update to authenticated using (public.is_admin() or created_by = public.current_atlas_user_id());

create policy task_templates_read on public.task_templates for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy task_templates_admin on public.task_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy automations_read on public.automations for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy automations_admin on public.automations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy automation_runs_read on public.automation_runs for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy goals_read on public.goals for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy goals_admin on public.goals for all to authenticated using (public.is_admin()) with check (public.is_admin());

/* down:
alter table public.tasks drop constraint tasks_goal_fk, drop constraint tasks_plan_fk, drop column recurrence, drop column goal_id;
drop function public.ai_spend_this_month();
drop table public.goals, public.automation_runs, public.automations, public.task_templates, public.plans cascade;
delete from public.settings where key = 'ai';
*/
