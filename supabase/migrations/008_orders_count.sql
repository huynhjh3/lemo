-- 008: "usage" is a count of completed orders, not a dollar figure.
-- gross_revenue keeps driving the revenue-share % calc unchanged;
-- orders_count is a separate, purely informational usage metric.
alter table revenue_csv_uploads add column orders_count integer;
