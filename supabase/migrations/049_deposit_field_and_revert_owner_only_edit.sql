-- 049: reverses migration 048 — Consultants and Strategic Partners can
-- edit deal terms again. Justin changed the approach: instead of an
-- Owner-only write lock, these figures now hide from non-owners once a
-- company reaches Installed (implemented client-side — CompanyProfile.jsx/
-- CompaniesPage.jsx/ui.jsx's DealTypeBadge — since Postgres RLS is
-- row-level and can't conditionally mask one column based on the row's
-- own stage without a view; a direct API call could still read the raw
-- value, unlike the write-lock this replaces which really was enforced at
-- the DB level).
drop trigger companies_before_insert_or_update_deal_terms on companies;
drop function prevent_non_owner_deal_terms_change();

-- New field, same editability as deal_value/fixed_rent_amount (i.e.
-- whoever can edit the company at all) and the same "hidden once
-- Installed for non-owners" visibility rule applied client-side.
alter table companies add column deposit_amount numeric(12,2)
  check (deposit_amount is null or deposit_amount >= 0);
