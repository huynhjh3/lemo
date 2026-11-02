-- 068: event RSVPs. An Owner creates an event in CRM -> Inbox -> Events (name,
-- date, venue, capacity, RSVP deadline). The /connect page asks landing-intake for
-- the event's details and spots left, and posts each RSVP to it. landing-intake
-- enforces capacity (a full event waitlists new RSVPs), emails the confirmation
-- with a calendar invite, and records the guest here. Owner-only throughout; the
-- public page never reads these tables directly.

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text,
  address text,
  details text,
  capacity int check (capacity is null or capacity > 0),   -- counts guests, not RSVPs; null = no limit
  rsvp_closes_at timestamptz,                               -- null = open until the event starts
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text not null,
  company text,
  guests int not null default 1 check (guests between 1 and 6),   -- including the person
  coming_as text,
  notes text,
  source text,
  influencer_id uuid references influencers(id) on delete set null,
  newsletter_opt_in boolean not null default false,
  status text not null default 'confirmed' check (status in ('confirmed','waitlist','cancelled','attended')),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);
create index event_rsvps_event_idx on event_rsvps(event_id, status);

-- the landing page now reports RSVP clicks and submissions too
alter table landing_events drop constraint landing_events_event_check;
alter table landing_events add constraint landing_events_event_check check (event in (
  'view','click_contact','click_newsletter','click_bd','click_rsvp',
  'submit_contact','submit_newsletter','submit_bd','submit_rsvp'
));

alter table events enable row level security;
alter table event_rsvps enable row level security;
create policy events_select on events for select to authenticated using ((select my_role()) = 'owner');
create policy events_insert on events for insert to authenticated with check ((select my_role()) = 'owner');
create policy events_update on events for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy events_delete on events for delete to authenticated using ((select my_role()) = 'owner');
create policy event_rsvps_select on event_rsvps for select to authenticated using ((select my_role()) = 'owner');
create policy event_rsvps_insert on event_rsvps for insert to authenticated with check ((select my_role()) = 'owner');
create policy event_rsvps_update on event_rsvps for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy event_rsvps_delete on event_rsvps for delete to authenticated using ((select my_role()) = 'owner');
