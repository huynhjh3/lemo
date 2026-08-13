-- LemoCRM schema: run this once in the Supabase SQL editor.
-- Tables, triggers, and RLS policies for the CRM data model.

create extension if not exists pgcrypto;

-- ============== profiles ==============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'bd_consultant' check (role in ('owner','bd_consultant','partner','geo_partner')),
  -- Set only for role = 'partner': the single company that partner represents.
  -- FK added below (after `companies` exists) via profiles_company_id_fkey.
  company_id uuid,
  -- Set only for role = 'geo_partner': which companies.region they're scoped
  -- to. Free text, same as companies.city — not a fixed list yet.
  region text,
  -- An owner with extra powers (maintenance mode below; add/delete-user
  -- later). Only ever true alongside role = 'owner' — see the constraint
  -- below — and only settable via the Supabase dashboard, same as role.
  is_master_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table profiles add constraint profiles_master_admin_requires_owner
  check (not is_master_admin or role = 'owner');

-- ============== companies ==============
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  industry text,
  city text,
  -- Which geo_partner (if any) this company falls under — matched against
  -- profiles.region. Free text, same as city.
  region text,
  -- set null (not the FK default of blocking the delete) so removing a
  -- rep's account doesn't get blocked by companies still assigned to them —
  -- they just go back to "Unassigned" (see transform.js's fallback).
  rep_id uuid references profiles(id) on delete set null,
  stage text not null default 'Lead'
    check (stage in ('Lead','Contacted','Proposal','Negotiation','Installed','Stay in Contact')),
  status text not null default 'healthy'
    check (status in ('healthy','attention','risk')),
  -- 'enterprise': deal_value is a flat monthly $ amount.
  -- 'revenue_share': deal_value is our % (0-100) of the partner's revenue.
  deal_type text not null default 'enterprise' check (deal_type in ('revenue_share','enterprise')),
  deal_value numeric(12,2) not null default 0
    check (deal_type <> 'revenue_share' or (deal_value >= 0 and deal_value <= 100)),
  -- False right after rep_id is set to someone other than whoever set it
  -- (see set_rep_confirmed below) — surfaced as a High Priority Action for
  -- that rep until they confirm it. Defaults true: self-assignment never
  -- needs confirming, and it's irrelevant while unassigned.
  rep_confirmed boolean not null default true,
  -- True from the moment a bd_consultant creates a company (auto-assigned
  -- as its rep — see prevent_bd_rep_change below) until an owner or that
  -- region's geo_partner confirms it. While true, that bd_consultant can
  -- edit the company's own fields but can't add contacts/outlets/devices/
  -- notes/tasks to it. Owner/geo_partner-created companies never set this.
  pending_review boolean not null default false,
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
-- security definer: inserts into a different table (revenue_entries), so
-- it needs to run with the owner's privileges regardless of which role
-- fired the update on companies — see the note above log_activity_audit.
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

create trigger companies_after_insert_or_update_revenue
  after insert or update on companies
  for each row execute function seed_revenue_on_installed();

-- Whenever rep_id is set (insert) or changed (update) to someone other than
-- whoever's making the change, that's a new assignment they haven't
-- confirmed yet. Self-assignment, or clearing rep_id, never needs confirming.
create or replace function set_rep_confirmed() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.rep_confirmed := (new.rep_id is null) or (new.rep_id = auth.uid());
  elsif new.rep_id is distinct from old.rep_id then
    new.rep_confirmed := (new.rep_id is null) or (new.rep_id = auth.uid());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger companies_before_insert_or_update_rep_confirmed
  before insert or update on companies
  for each row execute function set_rep_confirmed();

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

-- ============== pre_install_checklists ==============
-- One row per outlet (installation site), filled in by a BD consultant while
-- talking to the company ahead of an actual chair install. Deliberately
-- doesn't duplicate anything already on companies/outlets/contacts (site
-- name, address, onsite contact) — only covers schedule, installation-area
-- specifics, and delivery/access requirements, lifted from the "LEMO
-- Wellness Project Kickoff Form" (sections 3-5). completed_at drives both
-- the "Complete" badge and its High Priority Action — null until a
-- consultant explicitly marks it done, and cleared back to null by any
-- further edit (see upsertPreInstallChecklist in companies.js) so a stale
-- "complete" can't hide details that changed after the fact.
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

-- ============== device_usage_uploads ==============
-- Per-chair usage breakdown, matched from the backend's richer (chair-
-- level) CSV export by devices.serial. Purely additive: company-level
-- aggregate uploads (revenue_csv_uploads) are populated exactly as before
-- regardless of whether a file also has a chair identifier column — this
-- table only gets rows when it does and the serial matches an existing
-- device. Files without one behave exactly as before this table existed.
create table device_usage_uploads (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  upload_date date not null,
  orders_count integer not null default 0,
  revenue numeric(12,2) not null default 0,
  unique (device_id, upload_date)
);
create index device_usage_uploads_device_id_idx on device_usage_uploads(device_id);

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
  user_id uuid references profiles(id) on delete set null,
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
  author_id uuid references profiles(id) on delete set null,
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
  assigned_to uuid references profiles(id) on delete set null,
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
  uploaded_by uuid references profiles(id) on delete set null,
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
-- security definer: inserts into a different table (revenue_entries), and
-- also fires when the uploaded_by cascade nulls it out on user deletion
-- (migration 018) — see the note above log_activity_audit.
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
-- security definer: this fires on tables (companies, contacts, ...) that
-- can be modified by roles other than `authenticated` — e.g. deleting a
-- user cascades to null out companies.rep_id (migration 018), which is an
-- UPDATE executed by an internal Supabase role that has no grants on
-- public schema tables at all (it only manages the auth schema normally).
-- Without security definer, this function's own insert into activity_log
-- would run as that same underprivileged role and fail with "permission
-- denied for table activity_log" — security definer runs it as the
-- function's owner instead, who actually owns these tables.
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

-- Logs the deletion itself, once the company (and everything that cascades
-- from it) is gone. company_id is left null since the row no longer exists;
-- company_name carries the label instead.
-- security definer for the same reason as log_activity_audit above.
create or replace function log_company_deletion() returns trigger
language plpgsql security definer set search_path = public, pg_temp
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
create trigger audit_pre_install_checklists after insert or update on pre_install_checklists for each row execute function log_activity_audit();

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
alter table device_usage_uploads enable row level security;
alter table pre_install_checklists enable row level security;

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

-- A geo_partner's assigned region (see profiles.region above). Matched
-- against companies.region to scope owner/bd_consultant-equivalent access
-- down to one region instead of everything.
create or replace function my_region() returns text
language sql stable security definer set search_path = public, pg_temp
as $$ select region from public.profiles where id = auth.uid(); $$;

create or replace function my_is_master_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select coalesce((select is_master_admin from public.profiles where id = auth.uid()), false); $$;

-- Deliberately left executable by everyone (including internal Supabase
-- roles, not just `authenticated`) — they only ever return the caller's
-- own auth.uid()-scoped data, so there's no cross-user leakage to guard
-- against, and restricting them broke deleting a user (migration 019):
-- auth.admin.deleteUser()'s cascade fires companies' UPDATE triggers
-- (prevent_bd_rep_change, set_rep_confirmed, etc., which call my_role())
-- as an internal role that was never granted access under the old
-- authenticated-only grant.
grant execute on function my_role() to public;
grant execute on function my_company_id() to public;
grant execute on function my_region() to public;
grant execute on function my_is_master_admin() to public;
revoke create on schema public from public;

-- profiles: owner/bd_consultant/geo_partner read everyone (needed for rep
-- dropdowns / activity & note author display / Team view); a partner reads
-- only their own row. Users may only update their own row, and only their
-- name — not role, company_id, or region (checked below). No insert/delete
-- policy => denied by default (account creation is owner-invited-only via
-- the Supabase dashboard).
create policy profiles_select on profiles
  for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner') or id = auth.uid());
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Block a signed-in user from changing their own role, company_id, region,
-- or master-admin flag via the client (e.g. a partner reassigning
-- themselves to another company's data, a geo_partner self-assigning a
-- different region, or an owner granting themselves Master Admin).
-- auth.uid() is null when run from the Supabase SQL editor, so the
-- dashboard bootstrap/role-assignment flow is unaffected.
create or replace function prevent_self_role_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id
     and (new.role is distinct from old.role
          or new.company_id is distinct from old.company_id
          or new.region is distinct from old.region
          or new.is_master_admin is distinct from old.is_master_admin) then
    raise exception 'role/company/region/master-admin changes must be made via the Supabase dashboard';
  end if;
  return new;
end;
$$;
create trigger profiles_before_update
  before update on profiles
  for each row execute function prevent_self_role_change();

-- companies: owner sees/manages everything; a geo_partner is scoped to
-- companies whose region matches their own; a bd_consultant is scoped to
-- only the companies where they're the rep; a partner sees only their own
-- company (no write access at all).
create policy companies_select on companies for select to authenticated
  using (
    (select my_role()) = 'owner'
    or id = (select my_company_id())
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  );
create policy companies_insert on companies for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  );
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
-- Only owner and geo_partner (scoped to their region) can delete a company —
-- bd_consultant lost this (migration 013); they keep delete rights on
-- individual child rows (contacts/outlets/etc.), just not the company itself.
create policy companies_delete on companies for delete to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner' and region = (select my_region()))
  );

-- RLS is row-level, not column-level, so "owner and bd_consultant can both
-- insert/update companies, but only owner can touch the code column" can't
-- be expressed as a row policy alone — same reason prevent_self_role_change()
-- above is a trigger rather than folded into a policy.
create or replace function prevent_non_owner_code_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) <> 'owner' then
    if tg_op = 'INSERT' and new.code is not null then
      raise exception 'only an owner can set a company''s code';
    elsif tg_op = 'UPDATE' and new.code is distinct from old.code then
      raise exception 'only an owner can change a company''s code';
    end if;
  end if;
  return new;
end;
$$;
create trigger companies_before_insert_or_update_code
  before insert or update on companies
  for each row execute function prevent_non_owner_code_change();

-- A bd_consultant can't pick a company's rep — they're always auto-assigned
-- as their own companies' rep on create (and flagged pending_review, until
-- an owner/geo_partner confirms it), and can't change either field
-- afterward. Same "trigger, not RLS" shape as prevent_non_owner_code_change
-- above.
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

create trigger companies_before_insert_or_update_rep
  before insert or update on companies
  for each row execute function prevent_bd_rep_change();

-- Only an owner may set/change a company's region — a bd_consultant can't
-- assign one. geo_partner is untouched: they're already only ever able to
-- set region to their OWN region (companies_insert/update with-check
-- above), so blocking them here too would leave them unable to create a
-- company at all.
create or replace function prevent_bd_region_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) = 'bd_consultant' then
    if tg_op = 'INSERT' and new.region is not null then
      raise exception 'only an owner can assign a company''s region';
    elsif tg_op = 'UPDATE' and new.region is distinct from old.region then
      raise exception 'only an owner can change a company''s region';
    end if;
  end if;
  return new;
end;
$$;

create trigger companies_before_insert_or_update_region
  before insert or update on companies
  for each row execute function prevent_bd_region_change();

-- contacts / outlets / revenue_entries: a partner may read (not write) rows
-- belonging to their own company; a geo_partner may read/write rows
-- belonging to a company in their own region; a bd_consultant may
-- read/write rows belonging to a company where they're the rep.
--
-- DELETE is unconditional for geo_partner only (not region-checked) on
-- every table that cascade-deletes off `companies` (contacts, outlets,
-- devices, notes, tasks, revenue_entries, revenue_csv_uploads): by the time
-- a company-delete's cascade reaches these child rows, the parent company
-- row is already gone from a fresh subquery's point of view (MVCC — the
-- row's own deletion is visible to later sub-statements in the same
-- command), so a "company_id in (select ... from companies where region =
-- ...)" check would find no parent and block the cascade. bd_consultant
-- doesn't need this exception — they can't delete companies at all
-- (migration 013), so they never trigger that cascade — so their DELETE
-- stays scoped to their own companies like everything else.
create policy contacts_select on contacts for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy contacts_insert on contacts for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
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
create policy contacts_delete on contacts for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

create policy outlets_select on outlets for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy outlets_insert on outlets for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
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
create policy outlets_delete on outlets for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

create policy revenue_entries_select on revenue_entries for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy revenue_entries_insert on revenue_entries for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
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
create policy revenue_entries_delete on revenue_entries for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

-- devices: one hop further — via outlet_id -> outlets.company_id.
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

-- pre_install_checklists: same shape as devices above (one hop further via
-- outlet_id -> outlets.company_id).
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

-- notes / tasks: internal-only — zero partner access; geo_partner scoped by
-- region, bd_consultant scoped to their own companies (delete unconditional
-- for geo_partner only — see cascade-safety note above). INSERT is also
-- gated on pending_review = false for bd_consultant — this is the "can't
-- add notes/tasks until confirmed" half of the pending-review workflow.
create policy notes_select on notes for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy notes_insert on notes for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
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
create policy notes_delete on notes for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

create policy tasks_select on tasks for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy tasks_insert on tasks for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
  );
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
create policy tasks_delete on tasks for delete to authenticated
  using (
    (select my_role()) in ('owner','geo_partner')
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

-- activity_log: company_id is set null (not cascade) when a company is
-- deleted (migration 005), so this table never hits the cascade-ordering
-- hazard above — delete stays scoped for everyone. It does need a
-- null-company_id allowance for geo_partner though, since deleting an
-- in-region company logs a row with company_id = null (log_company_deletion
-- below) that they must still be able to insert (and see afterwards).
-- bd_consultant doesn't get that allowance — they can't delete companies,
-- so they'd never generate (or need to see) one of those orphaned rows.
create policy activity_log_select on activity_log for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
create policy activity_log_insert on activity_log for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
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
create policy activity_log_delete on activity_log for delete to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and (company_id is null
             or company_id in (select id from companies where region = (select my_region()))))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

-- revenue_csv_uploads: geo_partner does NOT get the CSV Upload page or its
-- data (select/insert/update stay owner/bd_consultant only) — but DELETE
-- still needs the cascade-safety exception, or deleting an in-region
-- company with upload history would fail.
-- select/insert/update are owner-only (migration 011 took bd_consultant's
-- CSV upload access away, matching the Upload CSV nav item being owner-only
-- too). delete keeps geo_partner for cascade safety (see the big comment
-- above devices_delete) — bd_consultant doesn't need that exception since
-- they can't delete companies at all (migration 013).
create policy revenue_csv_uploads_select on revenue_csv_uploads for select to authenticated
  using ((select my_role()) = 'owner');
create policy revenue_csv_uploads_insert on revenue_csv_uploads for insert to authenticated
  with check ((select my_role()) = 'owner');
create policy revenue_csv_uploads_update on revenue_csv_uploads for update to authenticated
  using ((select my_role()) = 'owner')
  with check ((select my_role()) = 'owner');
create policy revenue_csv_uploads_delete on revenue_csv_uploads for delete to authenticated
  using ((select my_role()) in ('owner','geo_partner'));

-- device_usage_uploads: same shape as revenue_csv_uploads above.
create policy device_usage_uploads_select on device_usage_uploads for select to authenticated
  using ((select my_role()) = 'owner');
create policy device_usage_uploads_insert on device_usage_uploads for insert to authenticated
  with check ((select my_role()) = 'owner');
create policy device_usage_uploads_update on device_usage_uploads for update to authenticated
  using ((select my_role()) = 'owner')
  with check ((select my_role()) = 'owner');
create policy device_usage_uploads_delete on device_usage_uploads for delete to authenticated
  using ((select my_role()) in ('owner','geo_partner'));

-- ============== app_settings ==============
-- Single row, read by everyone (even signed-out visitors — the login
-- screen itself needs to know we're in maintenance mode before rendering),
-- writable only by Master Admin. No insert/delete policy => a second row
-- can never be created through the app.
create table app_settings (
  id uuid primary key default gen_random_uuid(),
  maintenance_mode boolean not null default false,
  maintenance_message text
);
insert into app_settings default values;

alter table app_settings enable row level security;

create policy app_settings_select on app_settings for select to anon, authenticated using (true);
create policy app_settings_update on app_settings for update to authenticated
  using ((select my_is_master_admin()))
  with check ((select my_is_master_admin()));
