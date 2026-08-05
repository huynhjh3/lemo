-- 016: only an owner may set/change a company's region — a bd_consultant
-- can't assign one on create or edit. Matches the actual routing flow: a
-- bd_consultant creates the company, the owner is the one who assigns it a
-- region (which is what makes it visible to that region's geo_partner).
--
-- geo_partner is untouched on purpose: they're already only ever able to
-- set a company's region to their OWN region (RLS with-check on
-- companies_insert/update, migration 010). Blocking them here too would
-- leave them unable to create a company at all, since they could never
-- satisfy that check without ever being allowed to set region.
create or replace function prevent_bd_region_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) = 'bd_consultant' then
    if tg_op = 'INSERT' and new.region is not null then
      raise exception 'only an owner can assign a company''s region';
    elsif tg_op = 'UPDATE' and new.region is distinct from old.region then
      raise exception 'only an owner can change a company''s region';
    end if;
  end if;
  return new;
end;
$$;

create trigger companies_before_insert_or_update_region
  before insert or update on companies
  for each row execute function prevent_bd_region_change();
