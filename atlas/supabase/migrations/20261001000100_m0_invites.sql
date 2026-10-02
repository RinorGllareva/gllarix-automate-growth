-- M0 invites: access is invite-only. An admin (or the bootstrap seed) creates the public.users row
-- first; when that person's auth account is created (invite or magic link), it is linked by email.

create function public.link_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.users
     set auth_id = new.id, updated_at = now()
   where email = lower(new.email) and auth_id is null;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user();

-- Also link accounts that already existed before their Atlas profile was added.
create function public.link_existing_auth_users() returns void
language sql security definer set search_path = public as $$
  update public.users u
     set auth_id = a.id, updated_at = now()
    from auth.users a
   where u.auth_id is null and lower(a.email) = u.email
$$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger users_touch before update on public.users
  for each row execute function public.touch_updated_at();

-- At least one active admin must remain (admin/01_USERS_AND_ROLES.md).
create function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.role = 'admin' and old.active)
     and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.users where role = 'admin' and active and id <> old.id) then
    raise exception 'At least one active admin must remain';
  end if;
  return new;
end
$$;

create trigger users_keep_one_admin before update on public.users
  for each row execute function public.keep_one_admin();

/* down:
drop trigger users_keep_one_admin on public.users;
drop function public.keep_one_admin();
drop trigger users_touch on public.users;
drop function public.touch_updated_at();
drop function public.link_existing_auth_users();
drop trigger on_auth_user_created on auth.users;
drop function public.link_auth_user();
*/
