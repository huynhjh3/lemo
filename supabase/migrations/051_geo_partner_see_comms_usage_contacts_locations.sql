-- 051: widens read visibility for a Strategic Partner (geo_partner) to
-- match companies_select's own "see everything, write only in-region"
-- shape (migration 039) for four more things Justin wants visible outside
-- their own region: Communications Log, Contacts, Locations/Devices
-- (chair/location counts), and Usage. Write access (insert/update/delete)
-- on all of these is untouched — still region-scoped — so the existing
-- client-side `outOfRegion` guards in CompanyProfile.jsx correctly keep
-- hiding add/edit/delete controls; only what renders as read data changes.
--
-- Usage specifically needs care: revenue_csv_uploads and
-- device_usage_uploads each carry BOTH usage (orders_count) and revenue
-- ($ amount/gross_revenue) columns in the same rows — RLS is row-level,
-- so there's no way to expose one without technically exposing the other
-- to a raw API call. The app's own UI never renders the $ columns from
-- these two tables though (transform.js's buildUsageHistory/
-- buildUsageByChair only ever read orders_count) — the dollar figure a
-- Strategic Partner actually sees anywhere comes exclusively from
-- revenue_entries, which stays region-scoped exactly as migration 050
-- just set it. So: widen these two, leave revenue_entries alone.

drop policy contacts_select on contacts;
create policy contacts_select on contacts for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or (select my_role()) = 'geo_partner'
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy outlets_select on outlets;
create policy outlets_select on outlets for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or (select my_role()) = 'geo_partner'
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy devices_select on devices;
create policy devices_select on devices for select to authenticated
  using (
    (select my_role()) = 'owner'
    or outlet_id in (select id from outlets where company_id = (select my_company_id()))
    or (select my_role()) = 'geo_partner'
    or ((select my_role()) = 'bd_consultant'
        and outlet_id in (
          select id from outlets where company_id in (
            select id from companies where rep_id = auth.uid()
          )
        ))
  );

drop policy communications_log_select on communications_log;
create policy communications_log_select on communications_log for select to authenticated
  using (
    (select my_role()) = 'owner'
    or (select my_role()) = 'geo_partner'
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy revenue_csv_uploads_select on revenue_csv_uploads;
create policy revenue_csv_uploads_select on revenue_csv_uploads for select to authenticated
  using ((select my_role()) in ('owner','bd_consultant','geo_partner'));

drop policy device_usage_uploads_select on device_usage_uploads;
create policy device_usage_uploads_select on device_usage_uploads for select to authenticated
  using ((select my_role()) in ('owner','geo_partner'));
