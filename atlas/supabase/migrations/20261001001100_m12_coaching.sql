-- M12: call recordings, transcripts and AI reviews (call_reviews), human checks, disputes, weekly 1:1 agendas,
-- scorecard comments, the rubric-review list and the legal go/no-go flag.
-- Transcription and scoring run in Edge Functions (TranscriptionProvider; prompts/CALL_COACH_SYSTEM_PROMPT.md held as a secret).
-- Guardrails: work data only; no emotion, sentiment, tone-of-voice or biometric fields exist; pay (commissions) never reads these tables.

insert into public.settings (key, value) values
  ('coaching', '{"ai_scoring_verified": false, "verified_by": null, "verified_at": null, "recording_days": 90, "transcript_days": 365, "rubric_version": "2026-09-28.v1"}')
on conflict (key) do nothing;

create function public.ai_scoring_on() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> 'ai_scoring_verified')::boolean from public.settings where key = 'coaching'), false);
$$;

create table public.call_reviews (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.activities (id) on delete cascade,
  user_id uuid references public.users (id),            -- null once anonymised
  lead_id uuid references public.leads (id) on delete set null,
  company_name text not null,
  at timestamptz not null,
  duration_s integer not null,
  disposition text,
  local_hour integer,
  rubric_version text not null,
  status text not null check (status in ('scored', 'not_scored')),
  not_scored_reason text,
  scores jsonb not null default '[]',        -- per item: score (0–100 or null = not applicable) and quoted evidence lines
  total integer check (total between 0 and 100),
  compliance jsonb not null default '[]',    -- pass/fail with evidence
  compliance_pass boolean not null default true,
  suggestions jsonb not null default '{}',   -- keep doing / try next time / key moments
  transcript jsonb,                          -- speaker-labelled lines; null after 12 months
  recording_path text,                       -- private Storage path; served as signed, expiring URLs; null after 90 days
  recording_expires_at timestamptz not null,
  model text not null,
  cost_minor numeric(10, 2) not null default 0,
  human_reviewer_id uuid references public.users (id),
  human_score integer check (human_score between 0 and 100),
  human_at timestamptz,
  human_gap integer,
  human_flagged boolean not null default false,
  human_requested jsonb,
  disputed jsonb,
  anonymized boolean not null default false,
  created_at timestamptz not null default now(),
  -- Every score needs evidence (A17: "evidence or nothing").
  constraint scored_has_total check (status <> 'scored' or total is not null)
);
create index call_reviews_user_at_idx on public.call_reviews (user_id, at);

-- A human score more than 15 points from the AI's goes on the rubric review list.
create table public.rubric_flags (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.call_reviews (id) on delete cascade,
  gap integer not null,
  at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.one_on_ones (
  user_id uuid not null references public.users (id) on delete cascade,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  points jsonb not null,
  generated_at timestamptz not null default now(),
  edited_by uuid references public.users (id),
  edited_at timestamptz,
  primary key (user_id, week)
);

create table public.scorecard_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null,
  review_id uuid references public.call_reviews (id) on delete set null,
  kind text not null default 'comment' check (kind in ('comment', 'dispute')),
  at timestamptz not null default now()
);

alter table public.call_reviews enable row level security;
alter table public.rubric_flags enable row level security;
alter table public.one_on_ones enable row level security;
alter table public.scorecard_comments enable row level security;

-- The person and admins only; nothing at all while the legal flag is off. Viewers read team totals through a view, never rows.
create policy call_reviews_read on public.call_reviews for select to authenticated
  using (public.ai_scoring_on() and (public.is_admin() or user_id = public.current_atlas_user_id()));
create policy call_reviews_human_check on public.call_reviews for update to authenticated
  using (public.ai_scoring_on() and public.is_admin() and user_id is distinct from public.current_atlas_user_id());
create policy rubric_flags_admin on public.rubric_flags for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy one_on_ones_read on public.one_on_ones for select to authenticated
  using (public.ai_scoring_on() and (public.is_admin() or user_id = public.current_atlas_user_id()));
create policy one_on_ones_admin on public.one_on_ones for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy scorecard_comments_read on public.scorecard_comments for select to authenticated
  using (public.is_admin() or user_id = public.current_atlas_user_id());
create policy scorecard_comments_insert on public.scorecard_comments for insert to authenticated
  with check (author_id = public.current_atlas_user_id() and (public.is_admin() or user_id = public.current_atlas_user_id()));

-- Team totals for viewers: counts only, no names, no AI fields.
create view public.team_week_totals with (security_invoker = false) as
  select date_trunc('week', a.at) as week, count(*) filter (where a.type = 'call') as dials,
         count(*) filter (where a.type = 'call' and a.disposition not in ('No answer', 'Voicemail', 'Gatekeeper')) as conversations
  from public.activities a where public.current_atlas_role() in ('admin', 'viewer')
  group by 1;

/* down:
drop view public.team_week_totals;
drop table public.scorecard_comments, public.one_on_ones, public.rubric_flags, public.call_reviews cascade;
drop function public.ai_scoring_on();
delete from public.settings where key = 'coaching';
*/
