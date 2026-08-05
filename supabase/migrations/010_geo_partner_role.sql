-- 010: add the geo_partner role — a region-scoped tier between owner and
-- bd_consultant (hierarchy: owner sees everything, geo_partner sees/manages
-- only companies in their assigned region, bd_consultant below that).
--
-- region is a free-text field on both profiles (the geo_partner's assigned
-- region) and companies (which region a company belongs to) — mirrors the
-- existing free-text `city` field rather than a fixed enum, since the real
-- region boundaries aren't finalized yet. Tighten into a fixed list later
-- once they are, without needing another role/RLS migration.
--
-- Scope: a geo_partner gets the same read/write access as an owner/
-- bd_consultant, but only for companies (and everything under them) whose
-- region matches their own. They cannot see or touch other regions' data,
-- cannot touch companies.code (already owner-only, migration 009), and
-- don't get the Team or CSV Upload pages (enforced client-side in Sidebar;
-- also true at the RLS level for revenue_csv_uploads below).
--
-- DELETE is an exception to the region scoping for every table that cascade-
-- deletes off `companies` (contacts, outlets, devices, notes, tasks,
-- revenue_entries, revenue_csv_uploads): by the time a company-delete's
-- cascade reaches these child rows, the parent company row is already gone,
-- so a "company_id in (select ... from companies where region = ...)" check
-- would find no parent and block the cascade. Their DELETE policies grant
-- geo_partner the same unconditional access as owner/bd_consultant instead —
-- safe in practice since SELECT/INSERT/UPDATE stay region-scoped, so a
-- geo_partner never discovers another region's row ids through the app.

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('owner','bd_consultant','partner','geo_partner'));

alter table profiles add column region text;
alter table companies add column region text;

create or replace function my_region() returns text
language sql stable security definer set search_path = public, pg_temp
as $$ select region from public.profiles where id = auth.uid(); $$;
revoke all on function my_region() from public;
grant execute on function my_region() to authenticated;

-- Block a signed-in user from changing their own region via the client, same
-- as role/company_id (see prevent_self_role_change, migration/schema.sql) —
-- otherwise a geo_partner could just self-assign a different region.
create or replace function prevent_self_role_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id
     and (new.role is distinct from old.role
          or new.company_id is distinct from old.company_id
          or new.region is distinct from old.region) then
    raise exception 'role/company/region changes must be made via the Supabase dashboard';
  end if;
  return new;
end;
$$;

-- profiles: geo_partner also reads everyone (needed for rep dropdowns /
-- activity & note author display), same as owner/bd_consultant.
drop policy profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner') or id = auth.uid());

-- companies: geo_partner sees/manages only companies in their own region.
drop policy companies_select on companies;
create policy companies_select on companies for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or id = (select my_company_id())
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
  );
drop policy companies_insert on companies;
create policy companies_insert on companies for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
  );
drop policy companies_update on companies;
create policy companies_update on companies for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
  );
drop policy companies_delete on companies;
create policy companies_delete on companies for delete to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
  );

-- contacts: select/insert/update scoped via companies.region; delete
-- unconditional for geo_partner (cascade safety, see header comment).
drop policy contacts_select on contacts;
create policy contacts_select on contacts for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy contacts_insert on contacts;
create policy contacts_insert on contacts for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy contacts_update on contacts;
create policy contacts_update on contacts for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy contacts_delete on contacts;
create policy contacts_delete on contacts for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

-- outlets: identical shape to contacts.
drop policy outlets_select on outlets;
create policy outlets_select on outlets for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy outlets_insert on outlets;
create policy outlets_insert on outlets for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy outlets_update on outlets;
create policy outlets_update on outlets for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy outlets_delete on outlets;
create policy outlets_delete on outlets for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

-- revenue_entries: identical shape to contacts.
drop policy revenue_entries_select on revenue_entries;
create policy revenue_entries_select on revenue_entries for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy revenue_entries_insert on revenue_entries;
create policy revenue_entries_insert on revenue_entries for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy revenue_entries_update on revenue_entries;
create policy revenue_entries_update on revenue_entries for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
drop policy revenue_entries_delete on revenue_entries;
create policy revenue_entries_delete on revenue_entries for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

-- devices: one hop further via outlet_id -> outlets.company_id.
drop policy devices_select on devices;
create policy devices_select on devices for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or outlet_id in (select id from outlets where company_id = (select my_company_id()))
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
  );
drop policy devices_insert on devices;
create policy devices_insert on devices for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
  );
drop policy devices_update on devices;
create policy devices_update on devices for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
  );
drop policy devices_delete on devices;
create policy devices_delete on devices for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

-- notes: was a single "for all" policy — split so delete can be unconditional
-- for geo_partner (cascade safety) while select/insert/update stay scoped.
drop policy notes_internal on notes;
create policy notes_select on notes for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
create policy notes_insert on notes for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
create policy notes_update on notes for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
create policy notes_delete on notes for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

-- tasks: same split as notes.
drop policy tasks_internal on tasks;
create policy tasks_select on tasks for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
create policy tasks_insert on tasks for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
create policy tasks_update on tasks for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );
create policy tasks_delete on tasks for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

-- activity_log: company_id is set null (not cascade) when a company is
-- deleted (migration 005), so this table never hits the cascade-ordering
-- hazard above — no need to loosen delete. It does need a null-company_id
-- allowance though, since deleting an in-region company logs a row with
-- company_id = null (log_company_deletion, schema.sql) that a geo_partner
-- must still be able to insert (and see afterwards).
drop policy activity_log_internal on activity_log;
create policy activity_log_select on activity_log for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
  );
create policy activity_log_insert on activity_log for insert to authenticated
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
  );
create policy activity_log_update on activity_log for update to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
  )
  with check (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
  );
create policy activity_log_delete on activity_log for delete to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
  );

-- revenue_csv_uploads: geo_partner does NOT get the CSV Upload page or its
-- data (select/insert/update stay owner/bd_consultant only) — but DELETE
-- still needs the cascade-safety exception, or deleting an in-region company
-- with upload history would fail.
drop policy revenue_csv_uploads_internal on revenue_csv_uploads;
create policy revenue_csv_uploads_select on revenue_csv_uploads for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant'));
create policy revenue_csv_uploads_insert on revenue_csv_uploads for insert to authenticated
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy revenue_csv_uploads_update on revenue_csv_uploads for update to authenticated
  using ((select my_role()) in ('owner','bd_consultant'))
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy revenue_csv_uploads_delete on revenue_csv_uploads for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));
