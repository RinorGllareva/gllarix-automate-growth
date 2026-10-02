-- M9: tasks core (A15 v1): spaces → lists, tasks with subtasks, assignees, dependencies, checklist, comments with
-- @mentions, attachments (Supabase Storage bucket "task-attachments"), time entries, timers, activity, inbox, saved views.
-- RLS: admins see everything; other roles see the spaces listed for their role, plus tasks assigned to them.

-- Databases that ran the first version of M1 have its queue table under the name public.tasks: rename it to
-- public.queue_tasks (as M1 now creates it) so the task manager below can use the name. Only the M1 table has queue_date.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'queue_date') then
    alter table public.tasks rename to queue_tasks;
    alter index if exists public.tasks_owner_queue_idx rename to queue_tasks_owner_queue_idx;
    alter policy tasks_own on public.queue_tasks rename to queue_tasks_own;
  end if;
end $$;

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'ice',
  position integer not null default 0,
  roles public.atlas_role[] not null default '{}',
  created_at timestamptz not null default now()
);
insert into public.spaces (name, color, position, roles) values
  ('Company', 'ice', 0, '{}'), ('Sales', 'cyan', 1, '{bdr,closer}'), ('Lead gen', 'mint', 2, '{bdr,closer}'), ('Delivery', 'amber', 3, '{implementer}'),
  ('Development', 'lavender', 4, '{}'), ('Finance', 'amber', 5, '{}'), ('Operations', 'text-3', 6, '{}'), ('Research', 'cyan', 7, '{}');

create table public.task_lists (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null,
  statuses jsonb not null default '["todo","in_progress","review","done","blocked","cancelled"]',
  default_view text not null default 'list' check (default_view in ('list', 'board')),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.task_lists (id),
  parent_id uuid references public.tasks (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description_md text not null default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done', 'blocked', 'cancelled')),
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  category text,
  tags text[] not null default '{}',
  start_at date,
  due_at date,
  estimate_minutes integer check (estimate_minutes >= 0),
  position double precision not null default 0,
  recurrence_rule text,
  linked_type text check (linked_type in ('lead', 'deal', 'client', 'meeting')),
  linked_id uuid,
  created_by uuid references public.users (id),
  created_by_ai boolean not null default false,
  accepted_by uuid references public.users (id),
  plan_id uuid,
  imported_from text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  constraint linked_pair check ((linked_type is null) = (linked_id is null))
);
create index tasks_list_idx on public.tasks (list_id, position) where deleted_at is null;
create index tasks_linked_idx on public.tasks (linked_type, linked_id) where deleted_at is null;

-- Subtasks are one level deep.
create function public.guard_task_depth() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null and exists (select 1 from public.tasks p where p.id = new.parent_id and p.parent_id is not null) then
    raise exception 'Subtasks are one level deep';
  end if;
  new.updated_at = now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at = coalesce(new.completed_at, now()); end if;
  if new.status <> 'done' then new.completed_at = null; end if;
  return new;
end
$$;
create trigger tasks_guard before insert or update on public.tasks for each row execute function public.guard_task_depth();

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.users (id),
  primary key (task_id, user_id)
);
create index task_assignees_user_idx on public.task_assignees (user_id);

-- task_id waits on depends_on_id. Cycles are rejected.
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_id uuid not null references public.tasks (id) on delete cascade,
  type text not null default 'waiting_on',
  unique (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);
create function public.guard_task_cycle() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (
    with recursive chain(id) as (
      select new.depends_on_id
      union
      select d.depends_on_id from public.task_dependencies d join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'That dependency would create a loop';
  end if;
  return new;
end
$$;
create trigger task_dependencies_no_cycle before insert or update on public.task_dependencies for each row execute function public.guard_task_cycle();

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  position double precision not null default 0
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.users (id),
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.users (id),
  file_name text not null,
  content_type text not null,
  size integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.users (id),
  started_at timestamptz not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  source text not null check (source in ('timer', 'manual')),
  note text
);
create index time_entries_user_idx on public.time_entries (user_id, started_at);

-- One running timer per user.
create table public.running_timers (
  user_id uuid primary key references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  started_at timestamptz not null default now()
);

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid references public.users (id),
  at timestamptz not null default now(),
  text text not null
);

create table public.task_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null check (kind in ('mention', 'assigned', 'comment')),
  text text not null,
  actor_id uuid references public.users (id),
  at timestamptz not null default now(),
  read_at timestamptz
);
create index task_inbox_user_idx on public.task_inbox (user_id, at desc);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  list_id uuid references public.task_lists (id) on delete cascade,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, list_id, name)
);

-- Visibility: admin; the space's roles; or assigned (a subtask follows its parent).
create function public.can_see_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive t as (
    select id, parent_id, list_id from public.tasks where id = p_task
    union all
    select p.id, p.parent_id, p.list_id from public.tasks p join t on p.id = t.parent_id
  )
  select public.is_admin()
    or (public.current_atlas_role() <> 'viewer' and (
      exists (select 1 from t join public.task_assignees a on a.task_id = t.id where a.user_id = public.current_atlas_user_id())
      or exists (select 1 from t join public.task_lists l on l.id = t.list_id join public.spaces s on s.id = l.space_id where public.current_atlas_role() = any (s.roles))
    ));
$$;

alter table public.spaces enable row level security;
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.time_entries enable row level security;
alter table public.running_timers enable row level security;
alter table public.task_activity enable row level security;
alter table public.task_inbox enable row level security;
alter table public.saved_views enable row level security;

create policy spaces_read on public.spaces for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy spaces_admin on public.spaces for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy task_lists_read on public.task_lists for select to authenticated using (public.current_atlas_role() <> 'viewer');
create policy task_lists_write on public.task_lists for all to authenticated
  using (public.is_admin() or exists (select 1 from public.spaces s where s.id = space_id and public.current_atlas_role() = any (s.roles)))
  with check (public.is_admin() or exists (select 1 from public.spaces s where s.id = space_id and public.current_atlas_role() = any (s.roles)));

create policy tasks_read on public.tasks for select to authenticated using (public.can_see_task(id));
create policy tasks_update on public.tasks for update to authenticated using (public.can_see_task(id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (created_by = public.current_atlas_user_id() and (public.is_admin()
    or exists (select 1 from public.task_lists l join public.spaces s on s.id = l.space_id where l.id = list_id and public.current_atlas_role() = any (s.roles))
    or (parent_id is not null and public.can_see_task(parent_id))
    or public.current_atlas_role() in ('bdr', 'closer', 'implementer')));  -- own tasks elsewhere: the assignee row must be themself (enforced in the API)
-- No hard deletes: deleted_at moves a task to the trash (30 days, admins restore).

create policy task_assignees_rw on public.task_assignees for all to authenticated using (public.can_see_task(task_id)) with check (public.can_see_task(task_id));
create policy task_dependencies_rw on public.task_dependencies for all to authenticated using (public.can_see_task(task_id)) with check (public.can_see_task(task_id) and public.can_see_task(depends_on_id));
create policy checklist_rw on public.checklist_items for all to authenticated using (public.can_see_task(task_id)) with check (public.can_see_task(task_id));
create policy task_comments_read on public.task_comments for select to authenticated using (public.can_see_task(task_id));
create policy task_comments_insert on public.task_comments for insert to authenticated with check (user_id = public.current_atlas_user_id() and public.can_see_task(task_id));
create policy task_comments_own on public.task_comments for update to authenticated using (user_id = public.current_atlas_user_id() or public.is_admin());
create policy task_attachments_read on public.task_attachments for select to authenticated using (public.can_see_task(task_id));
create policy task_attachments_insert on public.task_attachments for insert to authenticated with check (user_id = public.current_atlas_user_id() and public.can_see_task(task_id));
create policy task_attachments_delete on public.task_attachments for delete to authenticated using (user_id = public.current_atlas_user_id() or public.is_admin());
create policy time_entries_read on public.time_entries for select to authenticated using (public.can_see_task(task_id));
create policy time_entries_own on public.time_entries for all to authenticated using (user_id = public.current_atlas_user_id() or public.is_admin()) with check (user_id = public.current_atlas_user_id() and public.can_see_task(task_id));
create policy running_timers_own on public.running_timers for all to authenticated using (user_id = public.current_atlas_user_id()) with check (user_id = public.current_atlas_user_id());
create policy task_activity_read on public.task_activity for select to authenticated using (public.can_see_task(task_id));
create policy task_activity_insert on public.task_activity for insert to authenticated with check (public.can_see_task(task_id));
create policy task_inbox_own on public.task_inbox for all to authenticated using (user_id = public.current_atlas_user_id()) with check (user_id = public.current_atlas_user_id());
create policy saved_views_own on public.saved_views for all to authenticated using (user_id = public.current_atlas_user_id()) with check (user_id = public.current_atlas_user_id());

-- M7's client follow-ups become tasks in Delivery › Client care, linked to the client.
insert into public.task_lists (space_id, name) select id, 'Client care' from public.spaces where name = 'Delivery';
with moved as (
  insert into public.tasks (list_id, title, status, priority, tags, due_at, linked_type, linked_id, created_at, completed_at)
  select (select l.id from public.task_lists l join public.spaces s on s.id = l.space_id where s.name = 'Delivery' and l.name = 'Client care'),
         ct.title, case when ct.done_at is null then 'todo' else 'done' end, 'high', array[ct.type], ct.due_at::date, 'client', ct.client_id, ct.created_at, ct.done_at
  from public.client_tasks ct
  returning id, linked_id, title
)
insert into public.task_assignees (task_id, user_id)
select m.id, ct.assignee_id from moved m join public.client_tasks ct on ct.client_id = m.linked_id and ct.title = m.title where ct.assignee_id is not null;
drop table public.client_tasks;

/* down:
create table public.client_tasks (...)  -- recreate from m7 if needed
drop table public.saved_views, public.task_inbox, public.task_activity, public.running_timers, public.time_entries, public.task_attachments,
  public.task_comments, public.checklist_items, public.task_dependencies, public.task_assignees, public.tasks, public.task_lists, public.spaces cascade;
drop function public.can_see_task(uuid), public.guard_task_cycle(), public.guard_task_depth();
*/
