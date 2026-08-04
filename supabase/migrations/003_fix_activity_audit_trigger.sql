-- 003: fix a pre-existing bug in log_activity_audit() that was silently
-- breaking company creation (and any update to contacts/outlets/notes/tasks).
--
-- The function is a single trigger shared across companies/contacts/outlets/
-- devices/notes/tasks. One branch read `new.type` (meant only for the
-- `devices` table) directly off the NEW record. Since NEW's concrete row
-- type is whatever table actually fired the trigger, `new.type` fails to
-- resolve with "record 'new' has no field 'type'" the moment this fires on
-- any table without a `type` column — e.g. every company insert, since
-- audit_companies fires this on every insert/update on `companies`. That
-- exception rolled back the insert; with no error handling in the old UI
-- code, this looked like the "stuck on Creating…" freeze rather than a
-- visible error.
--
-- Fix: read fields via to_jsonb(new)->>'field' instead of new.field — a
-- jsonb key lookup returns null for a missing key instead of erroring.
create or replace function log_activity_audit() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_label text;
  v_name text;
  v_row jsonb := to_jsonb(new);
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

  v_label := case tg_table_name
    when 'companies' then 'Company' when 'contacts' then 'Contact'
    when 'outlets' then 'Outlet' when 'devices' then 'Device'
    when 'notes' then 'Note' when 'tasks' then 'Task' end;
  v_name := case tg_table_name
    when 'devices' then v_row->>'type'
    when 'tasks' then v_row->>'title'
    when 'notes' then null
    else v_row->>'name' end;

  insert into activity_log (company_id, user_id, type, summary, occurred_at)
  values (
    v_company_id, auth.uid(), 'system',
    v_label || ' ' || (case tg_op when 'INSERT' then 'created' else 'updated' end)
      || coalesce(': ' || v_name, ''),
    current_date
  );
  return new;
end;
$$;
