-- 030: Communications Log — replaces the free-text Notes card on a
-- Company's profile with a structured log of actual contact events (when
-- it happened, who was talked to, what kind of contact, plus any
-- thoughts/strategy). Same RLS shape as the notes table it replaces.

create table communications_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  -- Optional link to a tracked Contact; contact_name is a free-text
  -- fallback (or a snapshot label) for when the person isn't one of the
  -- company's tracked contacts — same optional-link/free-text-fallback
  -- shape as showroom_bookings' company_id/prospect_name.
  contact_id uuid references contacts(id) on delete set null,
  contact_name text,
  type text not null check (type in ('cold_call','follow_up','meeting','email','text_message','other')),
  notes text not null,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index communications_log_company_id_idx on communications_log(company_id);
create index communications_log_occurred_at_idx on communications_log(occurred_at desc);

-- ============== log_activity_audit(): add a communications_log case ==============
-- No new company_id resolution branch needed — communications_log has a
-- direct company_id column, same as most tables, so the existing generic
-- `else v_company_id := new.company_id` branch already covers it.
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
    when 'communications_log' then 'Communication logged: ' || (v_row->>'type')
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

create trigger audit_communications_log after insert on communications_log for each row execute function log_activity_audit();

-- ============== RLS (same shape as notes) ==============
alter table communications_log enable row level security;

create policy communications_log_select on communications_log for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy communications_log_insert on communications_log for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
create policy communications_log_update on communications_log for update to authenticated
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
create policy communications_log_delete on communications_log for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
