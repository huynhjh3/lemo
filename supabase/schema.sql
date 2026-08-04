-- LemoCRM schema: run this once in the Supabase SQL editor.
-- Tables, triggers, and RLS policies for the CRM data model.

create extension if not exists pgcrypto;

-- ============== profiles ==============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'bd_consultant' check (role in ('owner','bd_consultant','partner')),
  -- Set only for role = 'partner': the single company that partner represents.
  -- FK added below (after `companies` exists) via profiles_company_id_fkey.
  company_id uuid,
  created_at timestamptz not null default now()
);

-- ============== companies ==============
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  industry text,
  city text,
  rep_id uuid references profiles(id),
  stage text not null default 'Lead'
    check (stage in ('Lead','Contacted','Proposal','Negotiation','Installed','Stay in Contact')),
  status text not null default 'healthy'
    check (status in ('healthy','attention','risk')),
  -- 'enterprise': deal_value is a flat monthly $ amount.
  -- 'revenue_share': deal_value is our % (0-100) of the partner's revenue.
  deal_type text not null default 'enterprise' check (deal_type in ('revenue_share','enterprise')),
  deal_value numeric(12,2) not null default 0
    check (deal_type <> 'revenue_share' or (deal_value >= 0 and deal_value <= 100)),
  created_date date not null default current_date,
  last_contact date,
  next_follow_up date,
  closed_date date,
  interest text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index companies_rep_id_idx on companies(rep_id);

-- profiles.company_id references companies, which didn't exist yet when
-- profiles was created above — add the FK now that companies exists.
alter table profiles add constraint profiles_company_id_fkey
  foreign key (company_id) references companies(id);
create index profiles_company_id_idx on profiles(company_id);

create or replace function set_company_closed_date() returns trigger as $$
begin
  if new.stage in ('Installed','Stay in Contact') and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    new.closed_date := current_date;
  elsif new.stage not in ('Installed','Stay in Contact') then
    new.closed_date := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger companies_before_insert_or_update
  before insert or update on companies
  for each row execute function set_company_closed_date();

-- Seeds a revenue_entries row for the current month from deal_value the moment
-- a company becomes 'Installed' (insert-as-Installed or transition into it).
-- Only seeds once (ON CONFLICT DO NOTHING) so it never overwrites revenue
-- edited by hand afterwards via the "Record revenue entry" form.
-- Only 'enterprise' deals get a flat monthly amount seeded here — 'revenue_share'
-- deals get their revenue from revenue_csv_uploads instead (see below).
create or replace function seed_revenue_on_installed() returns trigger as $$
begin
  if new.stage = 'Installed' and new.deal_type = 'enterprise'
     and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    insert into revenue_entries (company_id, period, amount)
    values (new.id, date_trunc('month', current_date)::date, new.deal_value)
    on conflict (company_id, period) do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger companies_after_insert_or_update_revenue
  after insert or update on companies
  for each row execute function seed_revenue_on_installed();

-- ============== contacts ==============
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index contacts_company_id_idx on contacts(company_id);

-- ============== outlets ==============
create table outlets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);
create index outlets_company_id_idx on outlets(company_id);

-- ============== devices ==============
create table devices (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  type text not null,
  serial text,
  status text not null default 'offline' check (status in ('online','offline')),
  installed_date date,
  created_at timestamptz not null default now()
);
create index devices_outlet_id_idx on devices(outlet_id);

-- ============== activity_log ==============
-- Backs the "Activity Timeline" section on a company's profile, and the
-- global "Recent Activity" feed on Overview. type='system' rows are
-- auto-generated by log_activity_audit() below; the rest are manually
-- logged by a BD consultant via the "Log activity" form.
--
-- company_id is nullable with `on delete set null` (not cascade) so history
-- survives a company being deleted instead of vanishing with it; company_name
-- is a write-time snapshot so a surviving row still shows a sensible name
-- once its company is gone (see log_activity_audit() / log_company_deletion()).
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  company_name text,
  user_id uuid references profiles(id),
  type text not null check (type in ('call','email','meeting','install','note','system')),
  summary text not null,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index activity_log_company_id_idx on activity_log(company_id);
create index activity_log_created_at_idx on activity_log(created_at desc);

-- ============== notes ==============
create table notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index notes_company_id_idx on notes(company_id);

-- ============== tasks ==============
-- type covers the full interaction set shared with activity_log (minus
-- 'system', which is audit-only) — logging a call/email/meeting/install
-- happens by creating a task of that type; Activity Timeline's own manual
-- entries don't offer a type picker and default to 'note'.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  type text not null default 'call' check (type in ('call','email','meeting','install','note')),
  due_date date not null,
  done boolean not null default false,
  assigned_to uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index tasks_company_id_idx on tasks(company_id);
create index tasks_due_date_idx on tasks(due_date);

-- ============== revenue_entries ==============
create table revenue_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  period date not null,          -- first-of-month, e.g. 2026-07-01
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, period)
);
create index revenue_entries_company_id_idx on revenue_entries(company_id);

-- ============== revenue_csv_uploads ==============
-- One row per company per day, from the daily backend CSV export. `amount`
-- is our computed share (gross_revenue * deal_value/100) for revenue_share
-- companies. Upserting on (company_id, upload_date) makes re-uploading a
-- day you've already done a correction rather than a duplicate.
create table revenue_csv_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  upload_date date not null,
  gross_revenue numeric(12,2) not null,
  amount numeric(12,2) not null,
  -- Usage is a count of completed orders, not a dollar figure — kept
  -- separate from gross_revenue/amount, which still only drive the
  -- revenue-share % calc. Nullable since the backend export may not
  -- include an order-count column yet.
  orders_count integer,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, upload_date)
);
create index revenue_csv_uploads_company_id_idx on revenue_csv_uploads(company_id);

-- Recomputes the month's revenue_entries.amount as the sum of that company's
-- daily upload rows for the month, every time a day is inserted or corrected.
-- This is what makes re-uploading the same day idempotent instead of additive.
-- Enterprise rows can live in revenue_csv_uploads too (as a usage signal —
-- see UploadPage.jsx), but their revenue is a flat monthly amount seeded by
-- seed_revenue_on_installed, not derived from CSV uploads — so this must
-- leave revenue_entries alone for anything that isn't revenue_share.
create or replace function sync_revenue_entry_from_csv() returns trigger as $$
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
$$ language plpgsql;

create trigger revenue_csv_uploads_after_change
  after insert or update on revenue_csv_uploads
  for each row execute function sync_revenue_entry_from_csv();

-- ============== recent-activity audit trigger ==============
-- Auto-logs a type='system' activity_log row whenever a BD consultant/owner
-- creates or edits a record, powering the Overview "Recent Activity" feed.
-- NEW/OLD's concrete row type varies by whichever table fired this trigger, so
-- direct field access like new.type errors out on tables lacking that column
-- (e.g. new.type against a companies row). jsonb key lookup never errors on a
-- missing key — it just returns null — so it's safe here; OLD is also safely
-- null on INSERT. Summaries are built per-table so Recent Activity reads like
-- "Moved to Negotiation stage" or "Device added: Chair" instead of a generic
-- "Company updated".
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

  -- e.g. a task with no company — nothing sensible to attach the log entry to.
  if v_company_id is null then
    return new;
  end if;

  -- Denormalized at write time so this row still shows a sensible name if
  -- the company is later deleted (see log_company_deletion() below).
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

-- Logs the deletion itself, once the company (and everything that cascades
-- from it) is gone. company_id is left null since the row no longer exists;
-- company_name carries the label instead.
create or replace function log_company_deletion() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  insert into activity_log (company_id, company_name, user_id, type, summary, occurred_at)
  values (null, old.name, auth.uid(), 'system', 'Company deleted: ' || old.name, current_date);
  return old;
end;
$$;

create trigger companies_after_delete_log after delete on companies for each row execute function log_company_deletion();

create trigger audit_companies after insert or update on companies for each row execute function log_activity_audit();
create trigger audit_contacts after insert on contacts for each row execute function log_activity_audit();
create trigger audit_outlets after insert on outlets for each row execute function log_activity_audit();
create trigger audit_devices after insert on devices for each row execute function log_activity_audit();
create trigger audit_notes after insert on notes for each row execute function log_activity_audit();
create trigger audit_tasks after insert or update on tasks for each row execute function log_activity_audit();

-- ============== RLS ==============
alter table profiles enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table outlets enable row level security;
alter table devices enable row level security;
alter table activity_log enable row level security;
alter table notes enable row level security;
alter table tasks enable row level security;
alter table revenue_entries enable row level security;
alter table revenue_csv_uploads enable row level security;

-- security definer so RLS on `profiles` isn't recursively re-evaluated when
-- other tables' policies check the caller's role/company. search_path lists
-- pg_temp explicitly (not omitted) to block the documented temp-table
-- hijack vector for security definer functions.
create or replace function my_role() returns text
language sql stable security definer set search_path = public, pg_temp
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function my_company_id() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select company_id from public.profiles where id = auth.uid(); $$;

revoke all on function my_role() from public;
revoke all on function my_company_id() from public;
grant execute on function my_role() to authenticated;
grant execute on function my_company_id() to authenticated;
revoke create on schema public from public;

-- profiles: owner/bd_consultant read everyone (needed for rep dropdowns /
-- activity & note author display / Team view); a partner reads only their
-- own row. Users may only update their own row, and only their name — not
-- role or company_id (checked below). No insert/delete policy => denied by
-- default (account creation is owner-invited-only via the Supabase dashboard).
create policy profiles_select on profiles
  for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant') or id = auth.uid());
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Block a signed-in user from changing their own role or company_id via the
-- client (e.g. a partner reassigning themselves to another company's data).
-- auth.uid() is null when run from the Supabase SQL editor, so the
-- dashboard bootstrap/role-assignment flow is unaffected.
create or replace function prevent_self_role_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id
     and (new.role is distinct from old.role or new.company_id is distinct from old.company_id) then
    raise exception 'role/company changes must be made via the Supabase dashboard';
  end if;
  return new;
end;
$$;
create trigger profiles_before_update
  before update on profiles
  for each row execute function prevent_self_role_change();

-- companies: owner/bd_consultant see and manage everything; a partner sees
-- only their own company (no write access at all).
create policy companies_select on companies for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant') or id = (select my_company_id()));
create policy companies_insert on companies for insert to authenticated
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy companies_update on companies for update to authenticated
  using ((select my_role()) in ('owner','bd_consultant'))
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy companies_delete on companies for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant'));

-- contacts / outlets / revenue_entries: same shape — a partner may read
-- (not write) rows belonging to their own company.
create policy contacts_select on contacts for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant') or company_id = (select my_company_id()));
create policy contacts_insert on contacts for insert to authenticated
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy contacts_update on contacts for update to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy contacts_delete on contacts for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant'));

create policy outlets_select on outlets for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant') or company_id = (select my_company_id()));
create policy outlets_insert on outlets for insert to authenticated
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy outlets_update on outlets for update to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy outlets_delete on outlets for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant'));

create policy revenue_entries_select on revenue_entries for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant') or company_id = (select my_company_id()));
create policy revenue_entries_insert on revenue_entries for insert to authenticated
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy revenue_entries_update on revenue_entries for update to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy revenue_entries_delete on revenue_entries for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant'));

-- devices: one hop further — via outlet_id -> outlets.company_id.
create policy devices_select on devices for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or outlet_id in (select id from outlets where company_id = (select my_company_id()))
  );
create policy devices_insert on devices for insert to authenticated
  with check ((select my_role()) in ('owner','bd_consultant'));
create policy devices_update on devices for update to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy devices_delete on devices for delete to authenticated
  using ((select my_role()) in ('owner','bd_consultant'));

-- notes / activity_log / tasks / revenue_csv_uploads: internal-only — zero partner access.
create policy notes_internal on notes for all to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy activity_log_internal on activity_log for all to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy tasks_internal on tasks for all to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
create policy revenue_csv_uploads_internal on revenue_csv_uploads for all to authenticated
  using ((select my_role()) in ('owner','bd_consultant')) with check ((select my_role()) in ('owner','bd_consultant'));
