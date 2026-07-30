-- Lemo CRM — Supabase schema
-- Mirrors the Company -> Outlet -> Chair -> usage-snapshot structure from
-- the SOP (see src/store.js for the equivalent in-memory shape).
-- Run this once in the Supabase SQL editor for a new project.

create table if not exists companies (
  id text primary key,                 -- e.g. CO0001
  name text not null,
  industry text,
  city text,
  rep text,
  stage text not null default 'Lead',  -- Lead/Contacted/Proposal/Negotiation/Won/Lost
  status text not null default 'healthy', -- healthy/attention/risk
  deal_value numeric not null default 0,
  created_date date,
  last_contact date,
  next_follow_up date,
  interest text,
  business_type text not null default 'revenue_share', -- enterprise/revenue_share
  monthly_fee numeric,
  split_to_lemo numeric,               -- % of usage revenue that goes to Lemo
  archived boolean not null default false,
  contacts jsonb not null default '[]',
  activity jsonb not null default '[]',
  notes jsonb not null default '[]',
  revenue_history jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists outlets (
  id text primary key,                 -- e.g. AU01
  company_id text not null references companies(id) on delete cascade,
  name text,
  address text
);

create table if not exists chairs (
  serial text primary key,             -- manufacturer-assigned, never reused
  outlet_id text not null references outlets(id) on delete cascade,
  type text,
  status text not null default 'online', -- online/offline/retired
  installed date,
  retired boolean not null default false
);

create table if not exists usage_snapshots (
  id bigint generated always as identity primary key,
  chair_serial text not null references chairs(serial) on delete cascade,
  date date not null,
  total numeric not null,
  unique (chair_serial, date)          -- one snapshot per chair per upload day
);

create table if not exists uploads (
  id bigint generated always as identity primary key,
  file_name text,
  upload_date date not null,
  row_count integer not null default 0,
  uploaded_by text,
  created_at timestamptz not null default now()
);

-- Realtime: push row changes to every connected browser so edits show up
-- for everyone without a manual refresh.
alter publication supabase_realtime add table companies, outlets, chairs, usage_snapshots, uploads;

-- Row Level Security: enabled (Supabase requires it), but permissive for
-- now since there's no login yet — anyone with the site link can read and
-- write, the same trust level as today's shared-link CRM. Tighten these
-- once Supabase Auth is added (see supabase/README.md).
alter table companies enable row level security;
alter table outlets enable row level security;
alter table chairs enable row level security;
alter table usage_snapshots enable row level security;
alter table uploads enable row level security;

create policy "public read/write - companies" on companies for all using (true) with check (true);
create policy "public read/write - outlets" on outlets for all using (true) with check (true);
create policy "public read/write - chairs" on chairs for all using (true) with check (true);
create policy "public read/write - usage_snapshots" on usage_snapshots for all using (true) with check (true);
create policy "public read/write - uploads" on uploads for all using (true) with check (true);
