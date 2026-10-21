-- 063: everything behind the public landing page (lemowellness.com/connect).
-- The page offers three paths — talk to us, newsletter + free 10-minute
-- massage, apply as a BD consultant — and reports page views and clicks so
-- conversion can be measured. Rows are written by the landing-intake Edge
-- Function (service role); the CRM's Inbox page reads them. Everything here
-- is Owner-only.

create table landing_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event text not null check (event in (
    'view','click_contact','click_newsletter','click_bd',
    'submit_contact','submit_newsletter','submit_bd'
  )),
  source text,
  created_at timestamptz not null default now()
);
create index landing_events_created_idx on landing_events(created_at);
create index landing_events_event_idx on landing_events(event, created_at);

create table web_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company text,
  title text,
  message text,
  source text,
  status text not null default 'new' check (status in ('new','confirmed','dismissed')),
  company_id uuid references companies(id) on delete set null,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index web_leads_status_idx on web_leads(status, created_at desc);

create table subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  source text,
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  coupon_code text,
  coupon_assigned_at timestamptz,
  created_at timestamptz not null default now()
);

-- A pool of one-time codes (loaded by an Owner, e.g. a batch from the China
-- team); each new subscriber is handed the next unused one.
create table coupon_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  assigned_to uuid references subscribers(id) on delete set null,
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);
create index coupon_codes_unassigned_idx on coupon_codes(created_at) where assigned_to is null;

create table bd_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  city text,
  experience text,
  why text,
  linkedin text,
  source text,
  status text not null default 'new' check (status in ('new','reviewing','interview','accepted','declined')),
  notes text,
  created_at timestamptz not null default now()
);
create index bd_applications_status_idx on bd_applications(status, created_at desc);

-- Atomically hands out the next unused code (skip locked, so two sign-ups at
-- the same instant can't get the same one). Only the Edge Function may call it.
create or replace function assign_next_coupon(p_subscriber uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  update coupon_codes
     set assigned_to = p_subscriber, assigned_at = now()
   where id = (
     select id from coupon_codes where assigned_to is null
      order by created_at, id limit 1 for update skip locked
   )
  returning code into v_code;
  return v_code;
end;
$$;
revoke all on function assign_next_coupon(uuid) from public, anon, authenticated;
grant execute on function assign_next_coupon(uuid) to service_role;

-- ---- RLS: Owner only ------------------------------------------------------
alter table landing_events enable row level security;
alter table web_leads enable row level security;
alter table subscribers enable row level security;
alter table coupon_codes enable row level security;
alter table bd_applications enable row level security;

create policy landing_events_select on landing_events for select to authenticated using ((select my_role()) = 'owner');

create policy web_leads_select on web_leads for select to authenticated using ((select my_role()) = 'owner');
create policy web_leads_update on web_leads for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy web_leads_delete on web_leads for delete to authenticated using ((select my_role()) = 'owner');

create policy subscribers_select on subscribers for select to authenticated using ((select my_role()) = 'owner');

create policy coupon_codes_select on coupon_codes for select to authenticated using ((select my_role()) = 'owner');
create policy coupon_codes_insert on coupon_codes for insert to authenticated with check ((select my_role()) = 'owner');
create policy coupon_codes_delete on coupon_codes for delete to authenticated using ((select my_role()) = 'owner' and assigned_to is null);

create policy bd_applications_select on bd_applications for select to authenticated using ((select my_role()) = 'owner');
create policy bd_applications_update on bd_applications for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy bd_applications_delete on bd_applications for delete to authenticated using ((select my_role()) = 'owner');
