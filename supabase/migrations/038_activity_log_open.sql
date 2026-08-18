-- 038: Recent Activity is now visible to every authenticated user,
-- regardless of role or region. Previously scoped to owner (all rows),
-- geo_partner (their own region + company-less system rows), and
-- bd_consultant (only companies they rep) — which meant a partner saw
-- nothing at all (no clause matched them). Only SELECT changes here;
-- insert/update/delete stay exactly as migration 015 left them.

drop policy activity_log_select on activity_log;

create policy activity_log_select on activity_log for select to authenticated
  using (true);
