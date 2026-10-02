-- M14: the AI co-founder (A19). Finance data (expenses, cash snapshots), the decision log (mirrors context/07),
-- knowledge_docs with full-text search (synced from context/, backbone/, plans/, pricing/, prompts/ on deploy, service role),
-- advisor threads, messages (content, tool calls, sources, model, cost), proposed actions (drafts), memory and settings.
-- The "advisor" Edge Function holds prompts/AI_COFOUNDER_SYSTEM_PROMPT.md and the Anthropic key as secrets, sends the core
-- context with prompt caching, and runs every tool as the asking user (their JWT), so these RLS policies apply to the AI too.
-- No tool writes outside advisor_* tables; only accepting an action (a person) creates tasks, decisions or documents.

insert into public.settings (key, value) values
  ('advisor', '{"roles": {"bdr": true, "closer": true, "implementer": false, "viewer": false}, "disabled_tools": {}, "monthly_cap_eur": 30}')
on conflict (key) do nothing;

create function public.advisor_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_atlas_role() = 'admin'
    or coalesce((select (value -> 'roles' ->> public.current_atlas_role()::text)::boolean from public.settings where key = 'advisor'), false);
$$;

-- Finance (admins write; admins and the viewer/accountant read) ----------------------------------------------------------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  vendor text not null,
  category text not null check (category in ('people', 'tools', 'data', 'usage', 'freelance', 'marketing', 'admin', 'fees')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('USD', 'EUR')),
  recurring boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'bank_export', 'stripe')),
  note text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (date);

create table public.cash_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  balance_minor bigint not null,
  currency text not null default 'EUR' check (currency = 'EUR'),
  source text not null default 'manual' check (source in ('manual', 'bank_export')),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- Decision log ------------------------------------------------------------------------------------------------------------

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  owner text not null,
  status text not null,                 -- approved · proposed · superseded … (free text, as in context/07)
  reason text not null default '',
  expected_impact text not null default '',
  review_date text not null default '',
  links text[] not null default '{}',
  source text not null check (source in ('context/07', 'advisor')),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- Knowledge (written by the deploy sync with the service role; read through search_knowledge) -----------------------------

create table public.knowledge_docs (
  path text primary key,                -- "context/07_ROADMAP_DECISIONS_AND_OPEN_QUESTIONS.md"
  version text not null,                -- content hash
  content text not null,
  finance boolean not null default false,   -- context/05, backbone/03, backbone/09, scenario plans, models
  server_only boolean not null default false, -- prompts/: used by Edge Functions, never returned to users
  tsv tsvector generated always as (to_tsvector('english', path || ' ' || content)) stored,
  synced_at timestamptz not null default now()
);
create index knowledge_docs_tsv_idx on public.knowledge_docs using gin (tsv);

create function public.search_knowledge(q text, max_rows integer default 5)
returns table (path text, snippet text, rank real)
language sql stable security invoker set search_path = public as $$
  select d.path,
         ts_headline('english', d.content, websearch_to_tsquery('english', q), 'MaxWords=60, MinWords=20, MaxFragments=2'),
         ts_rank(d.tsv, websearch_to_tsquery('english', q))
  from public.knowledge_docs d
  where d.tsv @@ websearch_to_tsquery('english', q)
  order by 3 desc
  limit least(max_rows, 20);
$$;

-- Advisor threads, messages, drafts, memory ------------------------------------------------------------------------------

create table public.advisor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id),   -- null: team thread from a scheduled job (admins)
  title text not null,
  kind text not null check (kind in ('question', 'briefing', 'month_end', 'alert')),
  topic text not null default 'QUESTION',
  key text unique,                              -- dedup for scheduled threads ("briefing:2026-W40")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.advisor_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  user_id uuid references public.users (id),
  content text not null,
  role_hint text,
  answer jsonb,                                 -- the board memo / short answer (incl. unsourced figures)
  tool_calls jsonb not null default '[]',       -- every tool call: name, args, ok, one-line result
  sources text[] not null default '{}',
  model text,
  cost_minor numeric(10, 3) not null default 0, -- USD cents
  knowledge_version text,
  created_at timestamptz not null default now()
);
create index advisor_messages_thread_idx on public.advisor_messages (thread_id, created_at);

create table public.advisor_actions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.advisor_messages (id) on delete cascade,
  kind text not null check (kind in ('tasks', 'decision', 'document')),
  status text not null default 'draft' check (status in ('draft', 'accepted', 'dismissed')),
  payload jsonb not null,                       -- tasks (title, owner, hours, due) · decision · document
  accepted_by uuid references public.users (id),
  accepted_at timestamptz,
  created_ids uuid[] not null default '{}',
  -- Accepting is a person's act: it records who.
  constraint accepted_by_person check (status <> 'accepted' or accepted_by is not null)
);

create table public.advisor_documents (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.advisor_actions (id),
  kind text not null,
  title text not null,
  content text not null,
  accepted_by uuid not null references public.users (id),
  accepted_at timestamptz not null default now()
);

create table public.advisor_memory (
  id uuid primary key default gen_random_uuid(),
  fact text not null check (length(fact) <= 300),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  proposed_by uuid references public.users (id),
  approved_by uuid references public.users (id),
  source_message_id uuid references public.advisor_messages (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.advisor_job_runs (
  key text primary key,                         -- "briefing:2026-W40", "close:2026-09", "alert:cash:<id>"
  thread_id uuid references public.advisor_threads (id) on delete set null,
  ran_at timestamptz not null default now()
);

-- RLS ---------------------------------------------------------------------------------------------------------------------

alter table public.expenses enable row level security;
alter table public.cash_snapshots enable row level security;
alter table public.decisions enable row level security;
alter table public.knowledge_docs enable row level security;
alter table public.advisor_threads enable row level security;
alter table public.advisor_messages enable row level security;
alter table public.advisor_actions enable row level security;
alter table public.advisor_documents enable row level security;
alter table public.advisor_memory enable row level security;
alter table public.advisor_job_runs enable row level security;

-- Finance: the BDR, closer and implementer get nothing (so the advisor gets nothing for them either).
create policy expenses_read on public.expenses for select to authenticated using (public.current_atlas_role() in ('admin', 'viewer'));
create policy expenses_admin on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cash_read on public.cash_snapshots for select to authenticated using (public.current_atlas_role() in ('admin', 'viewer'));
create policy cash_admin on public.cash_snapshots for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy decisions_read on public.decisions for select to authenticated using (public.advisor_enabled());
create policy decisions_admin on public.decisions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Knowledge: finance files only for finance roles; prompts never (Edge Functions read them with the service role).
create policy knowledge_read on public.knowledge_docs for select to authenticated
  using (not server_only and public.advisor_enabled() and (not finance or public.current_atlas_role() in ('admin', 'viewer')));

-- Threads: your own; team threads (scheduled jobs) for admins.
create policy threads_read on public.advisor_threads for select to authenticated
  using (public.advisor_enabled() and (user_id = public.current_atlas_user_id() or (user_id is null and public.is_admin())));
create policy threads_own on public.advisor_threads for insert to authenticated
  with check (public.advisor_enabled() and user_id = public.current_atlas_user_id() and kind = 'question');

create policy messages_read on public.advisor_messages for select to authenticated
  using (exists (select 1 from public.advisor_threads t where t.id = thread_id));   -- threads_read applies
create policy messages_user on public.advisor_messages for insert to authenticated
  with check (role = 'user' and user_id = public.current_atlas_user_id()
    and exists (select 1 from public.advisor_threads t where t.id = thread_id and t.user_id = public.current_atlas_user_id()));
-- Assistant messages are written by the Edge Function (service role) after the model answers.

create policy actions_read on public.advisor_actions for select to authenticated
  using (exists (select 1 from public.advisor_messages m where m.id = message_id));
create policy actions_decide on public.advisor_actions for update to authenticated
  using (exists (select 1 from public.advisor_messages m where m.id = message_id) and (kind <> 'decision' or public.is_admin()))
  with check (status in ('accepted', 'dismissed') and (status = 'dismissed' or accepted_by = public.current_atlas_user_id()));

create policy documents_read on public.advisor_documents for select to authenticated
  using (accepted_by = public.current_atlas_user_id() or public.is_admin());

create policy memory_read on public.advisor_memory for select to authenticated
  using (public.advisor_enabled() and (status = 'approved' or public.is_admin() or proposed_by = public.current_atlas_user_id()));
create policy memory_propose on public.advisor_memory for insert to authenticated
  with check (public.advisor_enabled() and status = 'draft' and proposed_by = public.current_atlas_user_id());
create policy memory_review on public.advisor_memory for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy job_runs_admin on public.advisor_job_runs for select to authenticated using (public.is_admin());

-- Scheduled jobs (pg_cron → the advisor Edge Function): Monday 07:00 CET briefing, month-end close on the 1st, alerts hourly.
-- select cron.schedule('advisor-monday-briefing', '0 6 * * 1', $$select net.http_post(url := '<project>/functions/v1/advisor-jobs', body := '{"job":"briefing"}')$$);
-- select cron.schedule('advisor-month-end', '0 6 1 * *', $$select net.http_post(url := '<project>/functions/v1/advisor-jobs', body := '{"job":"month_end"}')$$);
-- select cron.schedule('advisor-alerts', '15 * * * *', $$select net.http_post(url := '<project>/functions/v1/advisor-jobs', body := '{"job":"alerts"}')$$);
