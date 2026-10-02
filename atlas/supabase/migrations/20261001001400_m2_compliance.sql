-- M2 (completed after M14): score history on every score/tier change, nightly rescore, number flags for call_block
-- (Swiss directory asterisk), GDPR export/erase, and retention (erase personal data of lost or never-worked leads after
-- 12 months, configurable; stats stay). Scoring itself runs in the "score" Edge Function (port of services/scoring.ts).

-- Number flags (country_rules call_block), e.g. '{directory_asterisk}'.
alter table public.companies add column phone_flags text[] not null default '{}';
alter table public.contacts add column phone_flags text[] not null default '{}';

alter table public.leads add column erased_at timestamptz;

-- score_history: who changed, from what, and why.
alter table public.score_history
  add column prev_score smallint,
  add column prev_tier public.lead_tier,
  add column reason text not null default 'change' check (reason in ('initial', 'change', 'nightly', 'rescore', 'import', 'enrichment'));
create index score_history_lead_idx on public.score_history (lead_id, computed_at desc);

-- A row only when the score or tier changes (or the lead gets its first score), whoever writes the lead.
create function public.leads_score_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.score is distinct from old.score or new.tier is distinct from old.tier then
    insert into public.score_history (lead_id, score, tier, prev_score, prev_tier, model_version, breakdown, reason)
    values (new.id, new.score, new.tier,
            case when tg_op = 'UPDATE' then old.score end, case when tg_op = 'UPDATE' then old.tier end,
            coalesce(new.score_model_version, 'unscored'), new.score_breakdown,
            case when tg_op = 'INSERT' then 'initial' else coalesce(nullif(current_setting('atlas.score_reason', true), ''), 'change') end);
  end if;
  return new;
end;
$$;
create trigger leads_score_history after insert or update of score, tier on public.leads
  for each row execute function public.leads_score_history();

-- Erased identifiers stay on the opt-out list so imports and list builds never bring them back.
alter type public.suppression_reason add value if not exists 'erasure';

insert into public.settings (key, value) values ('retention', '{"months": 12}') on conflict (key) do nothing;

create table public.nightly_runs (
  date date primary key,
  at timestamptz not null default now(),
  rescored integer not null default 0,
  changed integer not null default 0,
  erased integer not null default 0
);
alter table public.nightly_runs enable row level security;
create policy nightly_runs_admin on public.nightly_runs for select to authenticated using (public.is_admin());

-- GDPR erasure (admin, or the retention job with the service role). Names, emails, phones, notes and email bodies go;
-- the lead row, stage, score and activity counts stay for stats.
create function public.erase_lead_personal_data(p_lead uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only admins can erase personal data';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Record why (e.g. the request date and channel)';
  end if;
  select company_id into v_company from public.leads where id = p_lead and erased_at is null;
  if v_company is null then
    raise exception 'Lead not found or already erased';
  end if;
  insert into public.suppression_list (value, type, reason, source)
    select lower(email), 'email'::public.suppression_type, 'erasure'::public.suppression_reason, 'manual' from public.contacts where company_id = v_company and email is not null
    union
    select phone_e164, 'phone', 'erasure', 'manual' from public.contacts where company_id = v_company and phone_e164 is not null
    union
    select phone_e164, 'phone', 'erasure', 'manual' from public.companies where id = v_company and phone_e164 is not null
  on conflict do nothing;
  update public.contacts set first_name = 'Erased', last_name = '', title = null, email = null, email_status = 'unknown', phone_e164 = null,
    phone_verified = false, linkedin_url = null where company_id = v_company;
  update public.activities set detail = null, summary = null, recording_url = null, transcript_url = null where lead_id = p_lead;
  update public.leads set erased_at = now(), suppressed = true, next_action_at = null, next_action_type = null, status_reason = p_reason where id = p_lead;
  insert into public.audit_log (user_id, action, entity, entity_id, after)
    values (public.current_atlas_user_id(), 'gdpr.erase', 'lead', p_lead, jsonb_build_object('reason', p_reason));
end;
$$;

-- Leads due for retention: lost, or never worked (no touch, new/researched, no attempts), older than the window.
create function public.retention_due(p_months integer) returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.leads
  where erased_at is null
    and (stage = 'lost' or (last_touch_at is null and stage in ('new', 'researched') and attempts_count = 0))
    -- Never-worked leads age from creation; lost ones from their last touch (updated_at moves on every rescore).
    and case when stage = 'lost' then coalesce(last_touch_at, updated_at) else created_at end < now() - make_interval(months => p_months);
$$;

-- Nightly (pg_cron, 02:00 UTC): the "nightly" Edge Function rescores active leads with
-- `set local atlas.score_reason = 'nightly'`, then erases retention_due(settings.retention.months), then writes nightly_runs.
-- select cron.schedule('atlas-nightly', '0 2 * * *', $$select net.http_post(url := '<project>/functions/v1/nightly')$$);
