-- M6: price book versions, versioned quotes, extra-discount approvals, Stripe (test mode) checkout, payments, clients.
-- The public quote page and the Stripe webhook run as Edge Functions with the service role; there are no anon policies.

-- Price book: one active version at a time; activating a new one needs a second admin (admin/06_PRICE_BOOK.md).
create table public.price_books (
  version text primary key,
  payload jsonb not null,
  active boolean not null default false,
  created_by uuid references public.users (id),
  approved_by uuid references public.users (id),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint activation_needs_second_admin check (not active or (approved_by is not null and approved_by is distinct from created_by))
);
create unique index price_books_one_active on public.price_books (active) where active;

alter table public.deals add column draft jsonb;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  version integer not null check (version > 0),
  price_book_version text not null references public.price_books (version),
  selection jsonb not null,
  currency text not null check (currency in ('USD', 'EUR')),
  setup_minor integer not null,
  monthly_minor integer not null,
  first_year_minor integer not null,
  deposit_minor integer not null,
  lines jsonb not null,
  adjustments jsonb not null default '[]',
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'paid', 'superseded')),
  token text not null unique,
  valid_until timestamptz not null,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  accepted_ip inet,
  checkout_session_id text,
  paid_at timestamptz,
  unique (deal_id, version),
  constraint accepted_needs_name check (accepted_at is null or length(coalesce(accepted_by_name, '')) > 0)
);

-- A saved version never changes its content; only its lifecycle fields move forward.
create function public.guard_quote_immutable() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.selection, new.setup_minor, new.monthly_minor, new.first_year_minor, new.deposit_minor, new.lines, new.adjustments, new.summary, new.currency, new.version, new.deal_id, new.token)
     is distinct from
     (old.selection, old.setup_minor, old.monthly_minor, old.first_year_minor, old.deposit_minor, old.lines, old.adjustments, old.summary, old.currency, old.version, old.deal_id, old.token) then
    raise exception 'Quote versions are immutable: save a new version';
  end if;
  if old.status in ('accepted', 'paid') and new.status not in ('accepted', 'paid') then
    raise exception 'An accepted quote cannot be reopened';
  end if;
  return new;
end
$$;
create trigger quotes_immutable before update on public.quotes for each row execute function public.guard_quote_immutable();

-- Extra discount above 10% needs both founders: the decider is a different admin from the requester. Hard cap 30%.
create table public.discount_approvals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  pct numeric(4, 1) not null check (pct > 10 and pct <= 30),
  note text,
  requested_by uuid not null references public.users (id),
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.users (id),
  decided_at timestamptz,
  constraint second_founder_decides check (decided_by is null or decided_by <> requested_by)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  lead_id uuid not null references public.leads (id),
  deal_id uuid not null unique references public.deals (id),
  status text not null default 'onboarding' check (status in ('onboarding', 'live', 'paused', 'churned')),
  live_at timestamptz,
  churned_at timestamptz,
  churn_reason text,
  created_at timestamptz not null default now()
);

create table public.checkout_sessions (
  id text primary key, -- Stripe cs_test_… id
  quote_id uuid not null references public.quotes (id) on delete cascade,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency in ('USD', 'EUR')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'complete', 'expired')),
  url text not null,
  created_at timestamptz not null default now()
);

-- Webhook idempotency: each Stripe event id is processed once.
create table public.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  client_id uuid references public.clients (id),
  amount_minor integer not null,
  currency text not null check (currency in ('USD', 'EUR')),
  type text not null check (type in ('setup_deposit', 'setup_balance', 'monthly', 'overage', 'annual')),
  status text not null default 'paid' check (status in ('paid', 'refunded', 'failed')),
  stripe_event_id text unique references public.stripe_events (id),
  stripe_session_id text,
  paid_at timestamptz not null default now()
);

-- Setup commissions: one per deal, earnable after the 30-day clawback window.
alter table public.commissions add column earnable_at timestamptz, add column note text;
create unique index commissions_one_setup_per_deal on public.commissions (deal_id) where type = 'setup_commission';

-- Won by Stripe: the webhook (service role) may set Won; people still follow the M4 rule.
create or replace function public.guard_deal_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage and not public.is_admin() and coalesce(auth.role(), '') <> 'service_role'
     and new.stage in ('negotiation', 'won') then
    raise exception 'BDRs can move deals up to Proposal sent';
  end if;
  new.updated_at = now();
  if new.stage is distinct from old.stage then new.stage_changed_at = now(); end if;
  return new;
end
$$;

-- At most 2 won pilot deals per brand (context/02).
create function public.guard_pilot_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pilot and new.stage = 'won' and (old.stage is distinct from 'won' or not old.pilot)
     and (select count(*) from public.deals d where d.brand = new.brand and d.stage = 'won' and d.pilot and d.id <> new.id) >= 2 then
    raise exception 'No pilots left for this brand (max 2)';
  end if;
  return new;
end
$$;
create trigger deals_pilot_cap before update on public.deals for each row execute function public.guard_pilot_cap();

alter table public.price_books enable row level security;
alter table public.quotes enable row level security;
alter table public.discount_approvals enable row level security;
alter table public.clients enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.payments enable row level security;

create policy price_books_read on public.price_books for select to authenticated using (public.current_atlas_user_id() is not null);
create policy price_books_admin on public.price_books for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Quotes follow their deal's visibility; writers are the deal's editors.
create policy quotes_read on public.quotes for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id));
create policy quotes_insert on public.quotes for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_id and (public.is_admin() or (public.current_atlas_role() in ('bdr', 'closer') and d.owner_id = public.current_atlas_user_id())))
    -- BDRs quote from the price book without extra discount.
    and (public.current_atlas_role() <> 'bdr' or coalesce((selection ->> 'disc')::numeric, 0) = 0));
create policy quotes_update on public.quotes for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id and (public.is_admin() or (public.current_atlas_role() in ('bdr', 'closer') and d.owner_id = public.current_atlas_user_id()))));

create policy discount_read on public.discount_approvals for select to authenticated
  using (public.is_admin() or requested_by = public.current_atlas_user_id());
create policy discount_request on public.discount_approvals for insert to authenticated
  with check (requested_by = public.current_atlas_user_id() and public.current_atlas_role() in ('admin', 'closer') and status = 'pending');
create policy discount_decide on public.discount_approvals for update to authenticated
  using (public.is_admin() and requested_by <> public.current_atlas_user_id())
  with check (decided_by = public.current_atlas_user_id());

create policy clients_read on public.clients for select to authenticated
  using (public.current_atlas_role() in ('admin', 'implementer', 'viewer'));
create policy clients_admin on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payments_read on public.payments for select to authenticated
  using (public.current_atlas_role() in ('admin', 'viewer'));

create policy checkout_read on public.checkout_sessions for select to authenticated using (public.is_admin());
-- stripe_events: service role only (no policies).

/* down:
drop trigger deals_pilot_cap on public.deals;
drop function public.guard_pilot_cap();
drop index public.commissions_one_setup_per_deal;
alter table public.commissions drop column earnable_at, drop column note;
drop table public.payments, public.stripe_events, public.checkout_sessions, public.clients, public.discount_approvals, public.quotes, public.price_books cascade;
drop function public.guard_quote_immutable();
alter table public.deals drop column draft;
-- then re-create guard_deal_stage() from m4_sales.
*/
