-- M10: availability (weekly windows in each person's timezone, category split, task-time categories), time off,
-- capacity settings (focus factor, default buffer) and dismissed scheduler suggestions.
-- The scheduler (src/services/scheduler.ts) is pure TypeScript; in Supabase mode an Edge Function runs it on demand
-- and nightly, reading tasks, dependencies, time entries and these tables.

create table public.availability (
  user_id uuid primary key references public.users (id) on delete cascade,
  timezone text not null,
  -- {"sat": "09:00-15:00", "sun": "09:00-15:00"}; several windows per day are comma-separated.
  windows jsonb not null default '{}',
  -- {"development": 0.7, "review": 0.2, "management": 0.1}
  split jsonb not null default '{}',
  planned text[] not null default '{}',
  skills text[] not null default '{}',
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);

-- A split must add up to 100%.
create function public.guard_availability_split() returns trigger
language plpgsql set search_path = public as $$
declare total numeric;
begin
  select coalesce(sum(value::numeric), 0) into total from jsonb_each_text(new.split);
  if abs(total - 1) > 0.005 then
    raise exception 'The category split must add up to 100%% (now %)', round(total * 100);
  end if;
  new.updated_at = now();
  return new;
end
$$;
create trigger availability_split before insert or update on public.availability for each row execute function public.guard_availability_split();

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  "from" date not null,
  "to" date not null,
  reason text not null default 'Time off',
  created_at timestamptz not null default now(),
  check ("to" >= "from")
);
create index time_off_user_idx on public.time_off (user_id, "from");

insert into public.settings (key, value) values ('capacity', '{"focus_factor": 0.8, "default_buffer": 0.3, "agent_review_hours": 1.5}')
on conflict (key) do nothing;

create table public.dismissed_suggestions (
  user_id uuid not null references public.users (id) on delete cascade,
  suggestion_id text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, suggestion_id)
);

alter table public.availability enable row level security;
alter table public.time_off enable row level security;
alter table public.dismissed_suggestions enable row level security;

-- Admins see and edit everyone; others see and edit only themselves.
create policy availability_read on public.availability for select to authenticated using (public.is_admin() or user_id = public.current_atlas_user_id());
create policy availability_write on public.availability for all to authenticated
  using (public.is_admin() or user_id = public.current_atlas_user_id())
  with check (public.is_admin() or user_id = public.current_atlas_user_id());
create policy time_off_rw on public.time_off for all to authenticated
  using (public.is_admin() or user_id = public.current_atlas_user_id())
  with check (public.is_admin() or user_id = public.current_atlas_user_id());
create policy dismissed_own on public.dismissed_suggestions for all to authenticated using (user_id = public.current_atlas_user_id()) with check (user_id = public.current_atlas_user_id());

/* down:
drop table public.dismissed_suggestions, public.time_off, public.availability cascade;
drop function public.guard_availability_split();
delete from public.settings where key = 'capacity';
*/
