-- 027: Move pre_install_checklists from being keyed on outlet_id to task_id.
--
-- The Locations & Devices flow needs a physical outlet (and eventually a
-- specific chair) to exist before a checklist could be attached — but the
-- whole point of a *pre*-install checklist is to capture logistics before
-- any of that exists yet. Tasks don't have that chicken-and-egg problem: a
-- BD consultant can create a Task (type = 'install') the moment they start
-- talking installation logistics with a company, with no Location or
-- chair required yet. Same actions as before (save, mark complete, submit
-- for installation, owner approve, owner bypass) — just reattached to a
-- task instead of an outlet.
--
-- Existing rows are keyed to outlets that have no corresponding task, so
-- there's nothing sensible to migrate them to — truncated rather than
-- left orphaned. (This table has only existed for a few hours of manual
-- testing today, not real installed-customer data.)
truncate table pre_install_checklists;

drop policy pre_install_checklists_select on pre_install_checklists;
drop policy pre_install_checklists_insert on pre_install_checklists;
drop policy pre_install_checklists_update on pre_install_checklists;
drop policy pre_install_checklists_delete on pre_install_checklists;

alter table pre_install_checklists drop constraint pre_install_checklists_outlet_id_fkey;
drop index if exists pre_install_checklists_outlet_id_idx;
alter table pre_install_checklists drop column outlet_id;

alter table pre_install_checklists
  add column task_id uuid not null references tasks(id) on delete cascade unique;
create index pre_install_checklists_task_id_idx on pre_install_checklists(task_id);

-- ============== RLS (same shape as tasks itself — one hop via task_id) ==============
create policy pre_install_checklists_select on pre_install_checklists for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and task_id in (select id from tasks where company_id in (
          select id from companies where region = (select my_region())
        )))
    or ((select my_role()) = 'bd_consultant'
        and task_id in (select id from tasks where company_id in (
          select id from companies where rep_id = auth.uid()
        )))
  );
create policy pre_install_checklists_insert on pre_install_checklists for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and task_id in (select id from tasks where company_id in (
          select id from companies where region = (select my_region())
        )))
    or ((select my_role()) = 'bd_consultant'
        and task_id in (select id from tasks where company_id in (
          select id from companies where rep_id = auth.uid() and pending_review = false
        )))
  );
create policy pre_install_checklists_update on pre_install_checklists for update to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and task_id in (select id from tasks where company_id in (
          select id from companies where region = (select my_region())
        )))
    or ((select my_role()) = 'bd_consultant'
        and task_id in (select id from tasks where company_id in (
          select id from companies where rep_id = auth.uid()
        )))
  )
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and task_id in (select id from tasks where company_id in (
          select id from companies where region = (select my_region())
        )))
    or ((select my_role()) = 'bd_consultant'
        and task_id in (select id from tasks where company_id in (
          select id from companies where rep_id = auth.uid()
        )))
  );
create policy pre_install_checklists_delete on pre_install_checklists for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and task_id in (select id from tasks where company_id in (
          select id from companies where rep_id = auth.uid()
        )))
  );

-- ============== log_activity_audit(): resolve via tasks, not outlets ==============
create or replace function log_activity_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_company_name text;
  v_summary text;
  v_row jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
begin
  if tg_table_name = 'devices' then
    select company_id into v_company_id from outlets where id = new.outlet_id;
  elsif tg_table_name = 'pre_install_checklists' then
    select company_id into v_company_id from tasks where id = new.task_id;
  elsif tg_table_name = 'companies' then
    v_company_id := new.id;
  else
    v_company_id := new.company_id;
  end if;

  if v_company_id is null then
    return new;
  end if;

  v_company_name := case tg_table_name
    when 'companies' then v_row->>'name'
    else (select name from companies where id = v_company_id)
  end;

  v_summary := case tg_table_name
    when 'companies' then (
      case
        when tg_op = 'INSERT' then 'Company added'
        when v_old->>'stage' is distinct from v_row->>'stage' then 'Moved to ' || (v_row->>'stage') || ' stage'
        when v_old->>'status' is distinct from v_row->>'status' then 'Status changed to ' || (v_row->>'status')
        when v_old->>'deal_value' is distinct from v_row->>'deal_value'
          or v_old->>'deal_type' is distinct from v_row->>'deal_type' then 'Deal terms updated'
        when v_old->>'rep_confirmed' is distinct from v_row->>'rep_confirmed'
          and (v_row->>'rep_confirmed')::boolean then 'BD Consultant confirmed assignment'
        else 'Company details updated'
      end
    )
    when 'contacts' then
      (case when tg_op = 'INSERT' then 'Contact added: ' else 'Contact updated: ' end) || (v_row->>'name')
    when 'outlets' then
      (case when tg_op = 'INSERT' then 'Location added: ' else 'Location updated: ' end) || (v_row->>'name')
    when 'devices' then (
      case
        when tg_op = 'INSERT' then 'Device added: ' || (v_row->>'type')
        when v_old->>'status' is distinct from v_row->>'status' then (v_row->>'type') || ' marked ' || (v_row->>'status')
        else 'Device updated: ' || (v_row->>'type')
      end
    )
    when 'pre_install_checklists' then (
      case
        when tg_op = 'INSERT' and v_row->>'bypassed_at' is not null then 'Pre-install checklist bypassed'
        when tg_op = 'INSERT' then 'Pre-install checklist started'
        when v_old->>'bypassed_at' is distinct from v_row->>'bypassed_at' and v_row->>'bypassed_at' is not null
          then 'Pre-install checklist bypassed'
        when v_old->>'bypassed_at' is distinct from v_row->>'bypassed_at'
          then 'Pre-install checklist bypass undone'
        when v_old->>'approved_for_install_at' is distinct from v_row->>'approved_for_install_at'
          and v_row->>'approved_for_install_at' is not null
          then 'Pre-install checklist approved for installation'
        when v_old->>'submitted_for_install_at' is distinct from v_row->>'submitted_for_install_at'
          and v_row->>'submitted_for_install_at' is not null
          then 'Pre-install checklist submitted for installation'
        when v_old->>'completed_at' is distinct from v_row->>'completed_at' and v_row->>'completed_at' is not null
          then 'Pre-install checklist completed'
        else 'Pre-install checklist updated'
      end
    )
    when 'notes' then 'Note added'
    when 'tasks' then (
      case
        when tg_op = 'INSERT' then 'Task added: ' || (v_row->>'title')
        when (v_old->>'done')::boolean is distinct from (v_row->>'done')::boolean and (v_row->>'done')::boolean
          then 'Task completed: ' || (v_row->>'title')
        when (v_old->>'done')::boolean is distinct from (v_row->>'done')::boolean
          then 'Task reopened: ' || (v_row->>'title')
        else 'Task updated: ' || (v_row->>'title')
      end
    )
    else 'Updated'
  end;

  insert into activity_log (company_id, company_name, user_id, type, summary, occurred_at)
  values (v_company_id, v_company_name, auth.uid(), 'system', v_summary, current_date);
  return new;
end;
$$;
