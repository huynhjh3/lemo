-- 024: Owner approval on top of "Submit for Installation" (migration 022).
-- Submitting turns a completed checklist into a work order; approving is
-- the Owner explicitly signing off on it — a distinct action from a
-- company's stage later moving to Installed, which just tracks whether the
-- chair is physically in. Same reset rule as the others: any further edit
-- to the checklist (upsertPreInstallChecklist) clears this back to null
-- too, alongside completed_at/submitted_for_install_at, so a changed
-- detail always needs a fresh look.
--
-- No new RLS needed: approving is just another UPDATE on a row the caller
-- could already update (pre_install_checklists_update, migration 021) — the
-- UI gates the button to the owner role, same as the "Needs Code"/"Needs
-- Rep" High Priority Actions already do.

alter table pre_install_checklists
  add column approved_for_install_at timestamptz,
  add column approved_by uuid references profiles(id) on delete set null;

-- ============== log_activity_audit(): add the approved case ==============
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
  if tg_table_name in ('devices', 'pre_install_checklists') then
    select company_id into v_company_id from outlets where id = new.outlet_id;
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
        when tg_op = 'INSERT' then 'Pre-install checklist started'
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
