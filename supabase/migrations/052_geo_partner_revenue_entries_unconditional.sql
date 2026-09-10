-- Revert the revenue_entries_select portion of migration 050 back to
-- unconditional for geo_partner (matching migration 041's original text).
-- Aggregate figures (Revenue page, Overview forecast card) should be
-- system-wide for Strategic Partners; the region/company-scoped hide now
-- happens client-side instead, on individual company profile pages only
-- (see CompanyProfile.jsx's RevenueCard), not at the RLS layer. This
-- leaves revenue_csv_uploads_select/device_usage_uploads_select alone —
-- migration 051 already made those unconditional again.

drop policy revenue_entries_select on revenue_entries;
create policy revenue_entries_select on revenue_entries for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or (select my_role()) = 'geo_partner'
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );
