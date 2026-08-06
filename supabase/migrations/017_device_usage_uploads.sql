-- 017: per-chair usage breakdown, matched from the backend's richer
-- (chair-level) CSV export by devices.serial. Company-level aggregate
-- upload behavior (revenue_csv_uploads) is completely unchanged — this is
-- an additive, optional second table populated alongside it when the
-- uploaded file happens to include a chair identifier column that matches
-- an existing device's serial. Files without one (today's simple exports)
-- behave exactly as before.
create table device_usage_uploads (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  upload_date date not null,
  orders_count integer not null default 0,
  revenue numeric(12,2) not null default 0,
  unique (device_id, upload_date)
);
create index device_usage_uploads_device_id_idx on device_usage_uploads(device_id);

alter table device_usage_uploads enable row level security;

-- Same shape as revenue_csv_uploads (migration 011/015): owner-only
-- select/insert/update (this is populated from the same owner-only Upload
-- CSV page); delete also allows geo_partner for cascade safety when they
-- delete a company in their region (see the big comment above
-- devices_delete in schema.sql) — bd_consultant doesn't need it since they
-- can't delete companies at all.
create policy device_usage_uploads_select on device_usage_uploads for select to authenticated
  using ((select my_role()) = 'owner');
create policy device_usage_uploads_insert on device_usage_uploads for insert to authenticated
  with check ((select my_role()) = 'owner');
create policy device_usage_uploads_update on device_usage_uploads for update to authenticated
  using ((select my_role()) = 'owner')
  with check ((select my_role()) = 'owner');
create policy device_usage_uploads_delete on device_usage_uploads for delete to authenticated
  using ((select my_role()) in ('owner','geo_partner'));
