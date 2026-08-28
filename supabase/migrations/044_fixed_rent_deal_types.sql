-- 044: two new deal types for locations where Lemo pays the host instead
-- of being paid by them — 'fixed_rent' (malls, airports: pay a flat
-- monthly rent, keep a % of gross revenue — often 100%) and
-- 'fixed_plus_share' (large retail groups: same shape, but the host
-- negotiates a real revenue-share cut, so the % is meaningfully under
-- 100). Confirmed with Justin:
--   - deal_value keeps meaning "our %" for both new types, same
--     convention as revenue_share already uses.
--   - fixed_rent_amount (new column) holds the monthly rent — nullable,
--     since it's typed in once a location is installed, not necessarily
--     at creation time.
--   - Net monthly revenue = (that month's gross revenue-share cut) minus
--     fixed_rent_amount — computed once per month, not per day (rent
--     isn't a daily figure), and can go negative early in the month
--     before enough sales offset the rent (no non-negative constraint on
--     revenue_entries.amount, so this is allowed to render as a real
--     negative number, matching how Justin described it).

alter table companies add column fixed_rent_amount numeric(12,2)
  check (fixed_rent_amount is null or fixed_rent_amount >= 0);

alter table companies drop constraint companies_deal_type_check;
alter table companies add constraint companies_deal_type_check
  check (deal_type in ('revenue_share','enterprise','fixed_rent','fixed_plus_share'));

alter table companies drop constraint companies_deal_value_pct_check;
alter table companies add constraint companies_deal_value_pct_check
  check (deal_type not in ('revenue_share','fixed_rent','fixed_plus_share') or (deal_value >= 0 and deal_value <= 100));

-- Same trigger as before (migration 002/schema.sql), extended to the two
-- new types and to subtract the monthly rent once summed.
create or replace function sync_revenue_entry_from_csv() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_period date := date_trunc('month', new.upload_date)::date;
  v_total numeric(12,2);
  v_deal_type text;
  v_fixed_rent numeric(12,2);
begin
  select deal_type, fixed_rent_amount into v_deal_type, v_fixed_rent
  from companies where id = new.company_id;

  if v_deal_type not in ('revenue_share','fixed_rent','fixed_plus_share') then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_total
  from revenue_csv_uploads
  where company_id = new.company_id
    and date_trunc('month', upload_date) = date_trunc('month', new.upload_date);

  if v_deal_type in ('fixed_rent','fixed_plus_share') then
    v_total := v_total - coalesce(v_fixed_rent, 0);
  end if;

  insert into revenue_entries (company_id, period, amount)
  values (new.company_id, v_period, v_total)
  on conflict (company_id, period) do update set amount = excluded.amount;

  return new;
end;
$$;
