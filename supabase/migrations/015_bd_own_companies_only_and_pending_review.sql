-- 015: two connected changes.
--
-- 1. bd_consultant is scoped down from "sees/manages everything" to "sees
-- only companies where they're the rep" — everywhere (companies and every
-- child table: contacts/outlets/devices/revenue_entries/notes/tasks/
-- activity_log). This also retires the client-side "Mine"/"All" toggle
-- (App.jsx/Sidebar.jsx) — it's now redundant since RLS itself only ever
-- returns their own companies regardless of the toggle.
--
-- Since bd_consultant already lost company delete rights (migration 013)
-- and rep-assignment rights (migration 012), they never trigger a cascade
-- delete from deleting a company — so unlike geo_partner, their child-table
-- DELETE can be safely scoped to their own companies too, not left
-- unconditional. They're removed from revenue_csv_uploads_delete
-- entirely for the same reason (that exception existed only for the
-- cascade case, which no longer applies to them).
--
-- 2. Whenever a bd_consultant creates a company, they're automatically
-- assigned as its rep (no picking — they can't choose anyone else either,
-- same restriction as before, just no longer needing to leave it
-- unassigned). That company starts `pending_review = true`: an owner or
-- that region's geo_partner has to confirm it before the bd_consultant can
-- add contacts/outlets/devices/notes/tasks to it — everything else about
-- the company (its own fields) stays editable immediately. Owner/
-- geo_partner-created companies are unaffected (pending_review stays
-- false, same as before).

alter table companies add column pending_review boolean not null default false;

-- Was insert-only-if-null / block-any-update; now also does the
-- auto-assign-and-flag-for-review part of the create flow.
create or replace function prevent_bd_rep_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) = 'bd_consultant' then
    if tg_op = 'INSERT' then
      new.rep_id := auth.uid();
      new.pending_review := true;
    elsif new.rep_id is distinct from old.rep_id then
      raise exception 'only an owner or geo_partner can change a company''s rep';
    elsif new.pending_review is distinct from old.pending_review then
      raise exception 'only an owner or geo_partner can confirm a pending company';
    end if;
  end if;
  return new;
end;
$$;

-- ============== companies ==============
drop policy companies_select on companies;
create policy companies_select on companies for select to authenticated
  using (
    (select my_role()) = 'owner'
    or id = (select my_company_id())
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  );
drop policy companies_insert on companies;
create policy companies_insert on companies for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  );
drop policy companies_update on companies;
create policy companies_update on companies for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  );
-- companies_delete is untouched (already owner/geo_partner only, migration 013).

-- ============== contacts / outlets / revenue_entries ==============
drop policy contacts_select on contacts;
create policy contacts_select on contacts for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy contacts_insert on contacts;
create policy contacts_insert on contacts for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
drop policy contacts_update on contacts;
create policy contacts_update on contacts for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy contacts_delete on contacts;
create policy contacts_delete on contacts for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy outlets_select on outlets;
create policy outlets_select on outlets for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy outlets_insert on outlets;
create policy outlets_insert on outlets for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
drop policy outlets_update on outlets;
create policy outlets_update on outlets for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy outlets_delete on outlets;
create policy outlets_delete on outlets for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy revenue_entries_select on revenue_entries;
create policy revenue_entries_select on revenue_entries for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy revenue_entries_insert on revenue_entries;
create policy revenue_entries_insert on revenue_entries for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy revenue_entries_update on revenue_entries;
create policy revenue_entries_update on revenue_entries for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy revenue_entries_delete on revenue_entries;
create policy revenue_entries_delete on revenue_entries for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

-- ============== devices (one hop further via outlet_id) ==============
drop policy devices_select on devices;
create policy devices_select on devices for select to authenticated
  using (
    (select my_role()) = 'owner'
    or outlet_id in (select id from outlets where company_id = (select my_company_id()))
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid()
          )
        ))
  );
drop policy devices_insert on devices;
create policy devices_insert on devices for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid() and pending_review = false
          )
        ))
  );
drop policy devices_update on devices;
create policy devices_update on devices for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid()
          )
        ))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where region = (select my_region())
          )
        ))
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid()
          )
        ))
  );
drop policy devices_delete on devices;
create policy devices_delete on devices for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid()
          )
        ))
  );

-- ============== notes / tasks ==============
drop policy notes_select on notes;
create policy notes_select on notes for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy notes_insert on notes;
create policy notes_insert on notes for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
drop policy notes_update on notes;
create policy notes_update on notes for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy notes_delete on notes;
create policy notes_delete on notes for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy tasks_select on tasks;
create policy tasks_select on tasks for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy tasks_insert on tasks;
create policy tasks_insert on tasks for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
drop policy tasks_update on tasks;
create policy tasks_update on tasks for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy tasks_delete on tasks;
create policy tasks_delete on tasks for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

-- ============== activity_log ==============
drop policy activity_log_select on activity_log;
create policy activity_log_select on activity_log for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy activity_log_insert on activity_log;
create policy activity_log_insert on activity_log for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy activity_log_update on activity_log;
create policy activity_log_update on activity_log for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
drop policy activity_log_delete on activity_log;
create policy activity_log_delete on activity_log for delete to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

-- ============== revenue_csv_uploads ==============
-- bd_consultant loses this too — it only ever existed for cascade safety
-- when they could still delete companies (migration 011/013 already took
-- everything else away, and they lost company delete entirely in 013).
drop policy revenue_csv_uploads_delete on revenue_csv_uploads;
create policy revenue_csv_uploads_delete on revenue_csv_uploads for delete to authenticated
  using ((select my_role()) in ('owner','geo_partner'));
