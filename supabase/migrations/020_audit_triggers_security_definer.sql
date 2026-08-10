-- 020: "permission denied for table activity_log" — deleting a user
-- cascades to null out companies.rep_id, notes.author_id, tasks.assigned_to,
-- and revenue_csv_uploads.uploaded_by (migration 018). Those UPDATEs are
-- executed by an internal Supabase role that has no grants on public
-- schema tables at all (it only manages the auth schema normally) — the
-- UPDATEs themselves go through fine (FK referential actions run with
-- system-level authority), but they fire OUR OWN trigger functions, and
-- those run under normal privilege rules. Any of them that insert into a
-- *different* table fails outright, before RLS is even evaluated.
--
-- Fixed the same way my_role() etc. already were (migration 019):
-- security definer makes each insert run as the function's owner (who
-- actually owns these tables) regardless of which role fired the
-- triggering statement. Four functions needed it — the two hit by this
-- exact bug (log_activity_audit fires on tasks' UPDATE from the cascade;
-- log_company_deletion is the same pattern) plus two more with the same
-- latent issue found by auditing every trigger function that writes into
-- a different table (sync_revenue_entry_from_csv, seed_revenue_on_installed)
-- so this doesn't resurface piecemeal on the next delete.

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
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into activity_log (company_id, company_name, user_id, type, summary, occurred_at)
  values (null, old.name, auth.uid(), 'system', 'Company deleted: ' || old.name, current_date);
  return old;
end;
$$;

create or replace function seed_revenue_on_installed() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.stage = 'Installed' and new.deal_type = 'enterprise'
     and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    insert into revenue_entries (company_id, period, amount)
    values (new.id, date_trunc('month', current_date)::date, new.deal_value)
    on conflict (company_id, period) do nothing;
  end if;
  return new;
end;
$$;

create or replace function sync_revenue_entry_from_csv() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_period date := date_trunc('month', new.upload_date)::date;
  v_total numeric(12,2);
  v_deal_type text;
begin
  select deal_type into v_deal_type from companies where id = new.company_id;
  if v_deal_type is distinct from 'revenue_share' then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_total
  from revenue_csv_uploads
  where company_id = new.company_id
    and date_trunc('month', upload_date) = date_trunc('month', new.upload_date);

  insert into revenue_entries (company_id, period, amount)
  values (new.company_id, v_period, v_total)
  on conflict (company_id, period) do update set amount = excluded.amount;

  return new;
end;
$$;
