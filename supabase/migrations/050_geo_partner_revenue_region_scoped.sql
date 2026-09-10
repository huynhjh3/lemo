-- 050: reverses migration 041's visibility widening — a Strategic
-- Partner's revenue/usage access goes back to their own region only, on
-- the Revenue/Usage pages AND on an out-of-region company's own profile
-- (both are just RLS-scoped reads off the same three tables). Justin:
-- don't let Strategic Partners see revenue figures/bar charts outside
-- their own region. bd_consultant is untouched throughout — companies
-- itself has always been rep_id-scoped for them, so there's nothing
-- further to restrict.
--
-- revenue_csv_uploads and device_usage_uploads go from "geo_partner sees
-- everything" back to "geo_partner sees their own region" rather than the
-- pre-041 zero-access state — Justin's wording ("outside of their own
-- region") implies in-region visibility should stay, not disappear.
drop policy revenue_entries_select on revenue_entries;
create policy revenue_entries_select on revenue_entries for select to authenticated
  using (
    (select my_role()) = 'owner'
    or company_id = (select my_company_id())
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or ((select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
  );

drop policy revenue_csv_uploads_select on revenue_csv_uploads;
create policy revenue_csv_uploads_select on revenue_csv_uploads for select to authenticated
  using (
    (select my_role()) in ('owner','bd_consultant')
    or ((select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
  );

drop policy device_usage_uploads_select on device_usage_uploads;
create policy device_usage_uploads_select on device_usage_uploads for select to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner'
        and device_id in (
          select id from devices where outlet_id in (
            select id from outlets where company_id in (
              select id from companies where region = (select my_region())
            )
          )
        ))
  );
