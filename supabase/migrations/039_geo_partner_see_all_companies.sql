-- 039: A Strategic Partner (geo_partner) can now see every company,
-- system-wide, read-only — not just their own region (this is what feeds
-- both the Companies list and the Pipeline board, since both just render
-- whatever `companies` RLS returns). Insert/update/delete stay EXACTLY as
-- migrations 015/013 left them (region = my_region() for geo_partner), so
-- a geo_partner still can't create, edit, or delete anything outside their
-- own region — this migration only widens what they can see, not what
-- they can write.
--
-- Every other table that scopes geo_partner by region (contacts, outlets,
-- devices, tasks, notes, communications_log, revenue_entries) does so with
-- its own independent `region = (select my_region())` check, not by
-- deferring to companies_select — so none of them are affected by this
-- change; a geo_partner still can't drill into contacts/tasks/etc. on an
-- out-of-region company. That's a deliberate, separate decision if wanted
-- later, not an oversight here.
--
-- Two frontend spots assumed "companies is already region-scoped for
-- geo_partner via RLS" and needed a companion region check added now that
-- it's not — see src/lib/helpers.js's highPriorityActions (Needs Rep /
-- Pending Review) and CompanyProfile.jsx's canConfirmReview — otherwise a
-- geo_partner would get actionable-looking HPA items and a working-looking
-- "Confirm Review" button for every region's companies instead of just
-- their own.

drop policy companies_select on companies;

create policy companies_select on companies for select to authenticated
  using (
    (select my_role()) = 'owner'
    or id = (select my_company_id())
    or (select my_role()) = 'geo_partner'
    or ((select my_role()) = 'bd_consultant' and rep_id = auth.uid())
  );
