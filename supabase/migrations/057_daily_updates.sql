-- 057: daily_updates — the owner's own running log of context for each day
-- (the Revenue page's Daily Update card). The numbers in an update (orders,
-- $, month-to-date, pipeline) are recomputed from live data every time, so
-- only the hand-written context is stored — one row per calendar day.
--
-- Owner-only on every operation: the update is company-wide and gets
-- posted to the team chat by the owner, so there's no region/rep scoping to
-- reason about.

create table daily_updates (
  update_date date primary key,
  context text not null default '',
  updated_by uuid references profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table daily_updates enable row level security;

create policy daily_updates_select on daily_updates for select to authenticated
  using ((select my_role()) = 'owner');

create policy daily_updates_insert on daily_updates for insert to authenticated
  with check ((select my_role()) = 'owner');

create policy daily_updates_update on daily_updates for update to authenticated
  using ((select my_role()) = 'owner')
  with check ((select my_role()) = 'owner');

create policy daily_updates_delete on daily_updates for delete to authenticated
  using ((select my_role()) = 'owner');
