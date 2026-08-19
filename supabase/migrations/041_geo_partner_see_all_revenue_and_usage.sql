-- 041: A Strategic Partner (geo_partner) can now see revenue and usage for
-- every company, system-wide — not just their own region — matching
-- migration 039's "see everything, write only in-region" pattern for
-- companies. This widens three SELECT policies:
--
--   - revenue_entries (monthly revenue totals, feeds RevenuePage and each
--     company's Revenue card): was region-scoped for geo_partner, now
--     unconditional.
--   - revenue_csv_uploads (daily CSV rows, feeds each company's Usage card
--     and RevenuePage's usage total): geo_partner had NO select access at
--     all before this — owner/bd_consultant only (migration 010's original
--     design intentionally kept daily granularity owner/uploader-only).
--     Now granted, unconditionally.
--   - device_usage_uploads (per-chair usage breakdown): was owner-only, same
--     situation as above. Now also grants geo_partner, unconditionally.
--
-- Insert/update/delete on all three are untouched — a geo_partner still
-- can't write revenue/usage data for anyone, in-region or not (revenue is
-- always populated by CSV upload or the seed-on-install trigger, never
-- hand-entered by a geo_partner). This is read-only visibility, same shape
-- as migration 039.

drop policy revenue_entries_select on revenue_entries;
create policy revenue_entries_select on revenue_entries for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
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
