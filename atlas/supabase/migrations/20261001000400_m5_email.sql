-- M5: email templates, sending inboxes, outbox, branding settings. The sender runs server-side
-- (Edge Function on pg_cron, Gmail API with OAuth tokens in Supabase Vault — never in these tables).

create table public.email_templates (
  key text primary key,
  name text not null,
  channel text not null check (channel in ('email', 'linkedin')),
  list text not null check (list in ('trades', 'developers', 'any')),
  transactional boolean not null default false,
  subject text not null,
  body text not null check (body ~ '{{\s*unsubscribe_url\s*}}'),
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);

create table public.inboxes (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  brand text not null check (brand in ('gllarix', 'arcadian')),
  sender_name text not null,
  daily_cap integer not null check (daily_cap > 0),
  warmup_start integer not null default 10,
  warmup_step integer not null default 5,
  warmup_started_at timestamptz not null default now(),
  active boolean not null default true,
  -- Name of the Vault secret holding this inbox's OAuth refresh token.
  vault_secret_name text
);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  owner_id uuid references public.users (id),
  meeting_id uuid references public.meetings (id) on delete set null,
  kind text not null check (kind in ('cadence', 'send_info', 'no_show', 'booking_confirmation', 'reminder_24h', 'reminder_1h', 'manual')),
  template_key text references public.email_templates (key),
  step text,
  to_email text,
  subject text not null,
  body text not null,
  transactional boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'sent', 'blocked', 'cancelled')),
  reason text,
  not_before timestamptz,
  inbox_id uuid references public.inboxes (id),
  thread_id text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  replied_at timestamptz,
  reply_snippet text,
  unsubscribed_at timestamptz,
  -- A cadence step is never sent twice to the same lead.
  unique (lead_id, step)
);
create index email_messages_queued_idx on public.email_messages (status, not_before) where status = 'queued';
create index email_messages_thread_idx on public.email_messages (thread_id);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('branding', '{"footerAddress": "", "demoNumber": ""}');

alter table public.email_templates enable row level security;
alter table public.inboxes enable row level security;
alter table public.email_messages enable row level security;
alter table public.app_settings enable row level security;

create policy templates_read on public.email_templates for select to authenticated using (public.current_atlas_user_id() is not null);
create policy templates_admin on public.email_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy inboxes_admin on public.inboxes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- People see messages for leads they can see; they can queue (not send) emails to them.
create policy messages_read on public.email_messages for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));
create policy messages_queue on public.email_messages for insert to authenticated
  with check (status = 'queued' and exists (select 1 from public.leads l where l.id = lead_id and public.can_see_lead(l.owner_id)));

create policy settings_read on public.app_settings for select to authenticated using (public.current_atlas_user_id() is not null);
create policy settings_admin on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public, one-click unsubscribe: callable without a session; only ever adds to the opt-out list.
create function public.unsubscribe_message(p_message uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_email text; v_lead uuid;
begin
  select to_email, lead_id into v_email, v_lead from public.email_messages where id = p_message;
  if v_email is null then return null; end if;
  insert into public.suppression_list (value, type, reason, source) values (v_email, 'email', 'opt_out', 'unsubscribe')
    on conflict (type, value) do nothing;
  update public.email_messages set unsubscribed_at = coalesce(unsubscribed_at, now()) where id = p_message;
  update public.leads set suppressed = true where id = v_lead;
  update public.email_messages set status = 'cancelled', reason = 'Unsubscribed' where lead_id = v_lead and status = 'queued';
  insert into public.audit_log (action, entity, entity_id, after) values ('email.unsubscribe', 'suppression', v_lead, jsonb_build_object('email', v_email));
  return v_email;
end
$$;
grant execute on function public.unsubscribe_message(uuid) to anon;

/* down:
drop function public.unsubscribe_message(uuid);
drop table public.app_settings, public.email_messages, public.inboxes, public.email_templates cascade;
*/
