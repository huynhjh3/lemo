-- 005: preserve activity history when a company is deleted, and log the
-- deletion itself.
--
-- activity_log.company_id was NOT NULL with `on delete cascade`, so deleting
-- a company silently wiped every activity row that ever referenced it —
-- which is why Recent Activity went blank after deleting companies. Now:
--   - company_id is nullable with `on delete set null`, so history survives
--     the company being deleted instead of vanishing with it.
--   - a new company_name column is denormalized at write time, so a
--     surviving row still shows a sensible name after its company is gone.
--   - a new AFTER DELETE trigger on companies logs the deletion itself,
--     with company_id left null (the row no longer exists) and
--     company_name carrying the label.

alter table activity_log add column company_name text;

-- Best-effort backfill for rows whose company still exists right now —
-- can't recover names for companies already deleted before this migration.
update activity_log al set company_name = c.name
from companies c where c.id = al.company_id and al.company_name is null;

alter table activity_log drop constraint activity_log_company_id_fkey;
alter table activity_log alter column company_id drop not null;
alter table activity_log add constraint activity_log_company_id_fkey
  foreign key (company_id) references companies(id) on delete set null;

-- log_activity_audit() now also denormalizes company_name at write time.
create or replace function log_activity_audit() returns trigger
language plpgsql set search_path = public, pg_temp
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

create or replace function log_company_deletion() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  insert into activity_log (company_id, company_name, user_id, type, summary, occurred_at)
  values (null, old.name, auth.uid(), 'system', 'Company deleted: ' || old.name, current_date);
  return old;
end;
$$;

create trigger companies_after_delete_log
  after delete on companies
  for each row execute function log_company_deletion();
