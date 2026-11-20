-- 074: a Consultant can add contacts to their OWN company right away, even while the
-- company is still "Pending Review". The contact's email is what lets the CRM file
-- emailed replies onto the company automatically (mail-intake matches on it), so
-- nobody should have to wait for an Owner to confirm the company first.
-- Everything else a Consultant adds (locations, log entries, tasks) still waits for
-- confirmation. Only the insert policy changes; select/update/delete are untouched.
-- Re-runnable.

drop policy if exists contacts_insert on contacts;
create policy contacts_insert on contacts for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
