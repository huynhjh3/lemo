-- 048: only an owner can set or change a company's deal terms
-- (deal_type, deal_value, fixed_rent_amount) — same reasoning and shape as
-- 009's owner-only code restriction: RLS is row-level, so "owner and
-- bd_consultant/geo_partner can both insert/update companies, but only
-- owner can touch these three columns" needs a trigger, not a policy.
--
-- A Consultant or Strategic Partner creating a company now gets it seeded
-- as a plain Enterprise/$0 placeholder (the UI no longer even shows these
-- fields to them — see CompaniesPage.jsx/CompanyProfile.jsx) for an Owner
-- to fill in with the real negotiated terms afterward. Applies to update
-- too, not just creation, so it can't be bypassed by editing right after.
create or replace function prevent_non_owner_deal_terms_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) <> 'owner' then
    if tg_op = 'INSERT' then
      if new.deal_type is distinct from 'enterprise' then
        raise exception 'only an owner can set a company''s deal type';
      end if;
      if new.deal_value is distinct from 0 then
        raise exception 'only an owner can set a company''s deal value';
      end if;
      if new.fixed_rent_amount is not null then
        raise exception 'only an owner can set a company''s fixed rent amount';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.deal_type is distinct from old.deal_type then
        raise exception 'only an owner can change a company''s deal type';
      end if;
      if new.deal_value is distinct from old.deal_value then
        raise exception 'only an owner can change a company''s deal value';
      end if;
      if new.fixed_rent_amount is distinct from old.fixed_rent_amount then
        raise exception 'only an owner can change a company''s fixed rent amount';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger companies_before_insert_or_update_deal_terms
  before insert or update on companies
  for each row execute function prevent_non_owner_deal_terms_change();
