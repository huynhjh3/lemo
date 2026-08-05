-- 011: two independent changes bundled together from the same request.
--
-- 1. CSV upload lockdown: bd_consultant loses read/write access to
--    revenue_csv_uploads (Upload CSV becomes owner-only, matching the
--    already-owner-only Upload CSV nav item). DELETE is untouched —
--    bd_consultant still needs it so deleting a company with upload
--    history doesn't fail its cascade (same reasoning as migration 010's
--    geo_partner delete exception).
alter policy revenue_csv_uploads_select on revenue_csv_uploads
  using ((select my_role()) = 'owner');
alter policy revenue_csv_uploads_insert on revenue_csv_uploads
  with check ((select my_role()) = 'owner');
alter policy revenue_csv_uploads_update on revenue_csv_uploads
  using ((select my_role()) = 'owner')
  with check ((select my_role()) = 'owner');

-- 2. Rep assignment confirmation: when a company's rep_id is set (at
-- creation or reassignment) to someone other than whoever's making the
-- change, that's a new assignment they haven't seen yet — surfaced as a
-- High Priority Action on Overview until they confirm it. Self-assignment
-- (creating/keeping a company as your own rep) never needs confirming.
--
-- Defaults to true so this doesn't retroactively flag every already-
-- assigned company that existed before this migration — only rep_id
-- changes going forward run through set_rep_confirmed().
alter table companies add column rep_confirmed boolean not null default true;

create or replace function set_rep_confirmed() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.rep_confirmed := (new.rep_id is null) or (new.rep_id = auth.uid());
  elsif new.rep_id is distinct from old.rep_id then
    new.rep_confirmed := (new.rep_id is null) or (new.rep_id = auth.uid());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger companies_before_insert_or_update_rep_confirmed
  before insert or update on companies
  for each row execute function set_rep_confirmed();
