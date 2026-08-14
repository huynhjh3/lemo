-- 025: Showroom booking calendar, so two BD consultants (personal email
-- logins, no shared calendar account) can't accidentally book the same
-- chair-demo slot. Single physical showroom — no room/location column —
-- so the exclusion constraint below is a pure time-range overlap check,
-- no extension (btree_gist) needed since there's no scalar column to pair
-- it with.
--
-- Visible/bookable by any internal role (owner, geo_partner, bd_consultant)
-- — it's just a shared physical resource, not sensitive data. Only the
-- person who booked a slot (or an owner) can edit/cancel it.

create table showroom_bookings (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  -- Optional link to a tracked company; prospect_name covers a walk-in or
  -- a lead that isn't in the CRM as a company yet.
  company_id uuid references companies(id) on delete set null,
  prospect_name text,
  notes text,
  booked_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint showroom_bookings_valid_range check (end_at > start_at),
  exclude using gist (tstzrange(start_at, end_at, '[)') with &&)
);
create index showroom_bookings_start_at_idx on showroom_bookings(start_at);
create index showroom_bookings_company_id_idx on showroom_bookings(company_id);

alter table showroom_bookings enable row level security;

create policy showroom_bookings_select on showroom_bookings for select to authenticated
  using ((select my_role()) in ('owner','geo_partner','bd_consultant'));
create policy showroom_bookings_insert on showroom_bookings for insert to authenticated
  with check ((select my_role()) in ('owner','geo_partner','bd_consultant'));
create policy showroom_bookings_update on showroom_bookings for update to authenticated
  using (booked_by = auth.uid() or (select my_role()) = 'owner')
  with check (booked_by = auth.uid() or (select my_role()) = 'owner');
create policy showroom_bookings_delete on showroom_bookings for delete to authenticated
  using (booked_by = auth.uid() or (select my_role()) = 'owner');
