-- 021: Pre-Installation Checklist, one row per outlet (installation site).
--
-- Filled in by a BD consultant while talking to the company, ahead of an
-- actual chair install. Deliberately doesn't duplicate anything already on
-- companies/outlets/contacts (site name, address, onsite contact) — this
-- only covers the logistics that live nowhere else in the schema: schedule,
-- installation-area specifics, and delivery/access requirements, lifted
-- from the "LEMO Wellness Project Kickoff Form" (sections 3-5).
--
-- Same RLS shape as devices (one hop further via outlet_id -> outlets.company_id).
-- completed_at drives both the "Complete" badge and the High Priority Action
-- below — it's null until a consultant explicitly marks the checklist done,
-- and any further edit to the checklist clears it back to null (see
-- upsertPreInstallChecklist in companies.js) so a stale "complete" can't
-- hide details that changed after the fact.

create table pre_install_checklists (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null unique references outlets(id) on delete cascade,

  -- Schedule
  preferred_install_window text,
  required_completion_date date,
  install_time_window text,
  deadline_flexible text check (deadline_flexible in ('yes','somewhat','no')),
  deadline_event_details text,

  -- Installation area
  available_space text,
  chair_arrangement text check (chair_arrangement in
    ('side_by_side','across_from_each_other','front_to_back','separate_areas','not_yet_decided')),
  floor_access text check (floor_access in
    ('ground_floor','freight_elevator','passenger_elevator','no_elevator','basement','not_sure')),
  outlets_near_chairs text check (outlets_near_chairs in ('yes','no','not_sure')),
  photos_link text,

  -- Delivery and access
  delivery_access text check (delivery_access in
    ('loading_dock','delivery_entrance','standard_entrance','not_sure')),
  site_requirements text[] not null default '{}',
  site_requirements_other text,
  access_instructions text,
  early_receipt text check (early_receipt in ('yes','must_arrive_with_team','not_sure')),

  additional_notes text,

  -- Only ever set at insert time (the client never sends this column, so an
  -- upsert's ON CONFLICT DO UPDATE never touches it) — the default is what
  -- makes it "who created this", not "who last saved it".
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pre_install_checklists_outlet_id_idx on pre_install_checklists(outlet_id);

create or replace function touch_pre_install_checklist_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger pre_install_checklists_before_update
  before update on pre_install_checklists
  for each row execute function touch_pre_install_checklist_updated_at();

-- ============== log_activity_audit(): add pre_install_checklists ==============
-- Full redefinition (same pattern as every prior migration that's touched
-- this function) — adds pre_install_checklists to the outlet_id -> company_id
-- resolution branch (alongside devices) and a summary case for it. Also
-- listens for UPDATE (not just INSERT), same shape as tasks, so completing
-- a checklist logs its own "completed" line rather than only "started".
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

create trigger audit_pre_install_checklists after insert or update on pre_install_checklists
  for each row execute function log_activity_audit();

-- ============== RLS ==============
alter table pre_install_checklists enable row level security;

create policy pre_install_checklists_select on pre_install_checklists for select to authenticated
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
create policy pre_install_checklists_insert on pre_install_checklists for insert to authenticated
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
create policy pre_install_checklists_update on pre_install_checklists for update to authenticated
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
create policy pre_install_checklists_delete on pre_install_checklists for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid()
          )
        ))
  );
