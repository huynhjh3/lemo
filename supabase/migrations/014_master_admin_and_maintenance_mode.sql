-- 014: Master Admin flag (an owner with extra powers — starting with the
-- maintenance-mode kill switch below; add/delete-user comes in a later
-- migration alongside its Edge Function) and the kill switch itself.

alter table profiles add column is_master_admin boolean not null default false;
alter table profiles add constraint profiles_master_admin_requires_owner
  check (not is_master_admin or role = 'owner');

-- Block a signed-in user from granting themselves Master Admin, same
-- reasoning as role/company_id/region above.
create or replace function prevent_self_role_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id
     and (new.role is distinct from old.role
          or new.company_id is distinct from old.company_id
          or new.region is distinct from old.region
          or new.is_master_admin is distinct from old.is_master_admin) then
    raise exception 'role/company/region/master-admin changes must be made via the Supabase dashboard';
  end if;
  return new;
end;
$$;

create or replace function my_is_master_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select is_master_admin from public.profiles where id = auth.uid()), false); $$;
revoke all on function my_is_master_admin() from public;
grant execute on function my_is_master_admin() to authenticated;

-- profiles_select already lets owner/bd_consultant/geo_partner read
-- everyone (is_master_admin is just another column on rows they can
-- already see) — no policy change needed there.

-- ============== app_settings ==============
-- Single row, read by everyone (even signed-out visitors — the login
-- screen itself needs to know we're in maintenance mode before rendering),
-- writable only by Master Admin. No insert/delete policy => a second row
-- can never be created through the app.
create table app_settings (
  id uuid primary key default gen_random_uuid(),
  maintenance_mode boolean not null default false,
  maintenance_message text
);
insert into app_settings default values;

alter table app_settings enable row level security;

create policy app_settings_select on app_settings for select to anon, authenticated using (true);
create policy app_settings_update on app_settings for update to authenticated
  using ((select my_is_master_admin()))
  with check ((select my_is_master_admin()));
