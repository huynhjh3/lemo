-- 067: influencer / Instagram referral tracking. An Owner adds an influencer in
-- CRM -> Inbox -> Influencers and gets a tracked link (?src=<slug>) and an
-- optional promo code. The landing page already reports src on every visit and
-- form; landing-intake now resolves a lead's src (or promo code) to an
-- influencer, and "Add to pipeline" records which influencer referred the
-- company. The Influencers tab then reports visits, inquiries, referred
-- companies, installs, revenue, and commission owed. Owner-only throughout.

create table influencers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text,
  platform text not null default 'instagram',
  -- the value after ?src= in their link; also what landing_events.source holds
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  promo_code text unique check (promo_code is null or promo_code ~ '^[A-Z0-9]{3,20}$'),
  commission_type text not null default 'none' check (commission_type in ('none','flat_per_install','percent_revenue')),
  commission_value numeric(10,2) not null default 0 check (commission_value >= 0),
  -- percent_revenue only: count revenue from a company's first N months (null = all recorded)
  commission_months int check (commission_months is null or commission_months > 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Who referred a company. One referrer per company (first one recorded; an Owner can reassign).
create table influencer_referrals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references companies(id) on delete cascade,
  influencer_id uuid not null references influencers(id) on delete cascade,
  how text not null default 'manual' check (how in ('link','promo','manual')),
  created_at timestamptz not null default now()
);
create index influencer_referrals_influencer_idx on influencer_referrals(influencer_id);

alter table web_leads add column influencer_id uuid references influencers(id) on delete set null;
alter table web_leads add column promo_code text;
alter table subscribers add column influencer_id uuid references influencers(id) on delete set null;

alter table influencers enable row level security;
alter table influencer_referrals enable row level security;
create policy influencers_select on influencers for select to authenticated using ((select my_role()) = 'owner');
create policy influencers_insert on influencers for insert to authenticated with check ((select my_role()) = 'owner');
create policy influencers_update on influencers for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy influencers_delete on influencers for delete to authenticated using ((select my_role()) = 'owner');
create policy influencer_referrals_select on influencer_referrals for select to authenticated using ((select my_role()) = 'owner');
create policy influencer_referrals_insert on influencer_referrals for insert to authenticated with check ((select my_role()) = 'owner');
create policy influencer_referrals_update on influencer_referrals for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy influencer_referrals_delete on influencer_referrals for delete to authenticated using ((select my_role()) = 'owner');
