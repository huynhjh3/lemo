-- 043: lets an Owner define/recolor regions from the Companies page
-- instead of a hardcoded map in theme.js (see REGION_COLORS, migration
-- from the previous session) — region itself stays free-text on
-- companies/profiles (unchanged), this table is purely presentational:
-- which hex color a region's name renders as on the Companies grid.
-- Deleting a row here doesn't touch any company — it just falls back to
-- the plain neutral border, same as an unrecognized region always has.
create table region_colors (
  region text primary key,
  color text not null,
  created_at timestamptz not null default now()
);

alter table region_colors enable row level security;

-- Everyone needs to read this to render the legend/borders; only an
-- Owner manages it — matches Team/Upload CSV being Owner-only elsewhere.
create policy region_colors_select on region_colors for select to authenticated
  using (true);
create policy region_colors_insert on region_colors for insert to authenticated
  with check ((select my_role()) = 'owner');
create policy region_colors_update on region_colors for update to authenticated
  using ((select my_role()) = 'owner')
  with check ((select my_role()) = 'owner');
create policy region_colors_delete on region_colors for delete to authenticated
  using ((select my_role()) = 'owner');

-- Seeds the three regions already in use with the exact colors they
-- rendered as before this table existed, so nothing visually changes
-- the moment this migration runs.
insert into region_colors (region, color) values
  ('SoCal', '#4A6FA0'),
  ('LV', '#B23B2E'),
  ('PNW', '#B8912E')
on conflict (region) do nothing;
