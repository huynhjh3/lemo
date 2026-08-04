-- 006: track usage (raw CSV gross_revenue) for Enterprise companies too,
-- without letting it touch their flat monthly revenue_entries.
--
-- sync_revenue_entry_from_csv() previously recomputed revenue_entries for
-- ANY row inserted into revenue_csv_uploads. UploadPage.jsx is about to
-- start storing Enterprise rows (previously discarded entirely) so their
-- gross_revenue can power a usage view — but Enterprise revenue is a flat
-- monthly amount seeded by seed_revenue_on_installed, not derived from CSV
-- uploads, so this trigger must leave their revenue_entries alone.
create or replace function sync_revenue_entry_from_csv() returns trigger as $$
declare
  v_period date := date_trunc('month', new.upload_date)::date;
  v_total numeric(12,2);
  v_deal_type text;
begin
  select deal_type into v_deal_type from companies where id = new.company_id;
  if v_deal_type is distinct from 'revenue_share' then
    return new;
  end if;

  select coalesce(sum(amount), 0) into v_total
  from revenue_csv_uploads
  where company_id = new.company_id
    and date_trunc('month', upload_date) = date_trunc('month', new.upload_date);

  insert into revenue_entries (company_id, period, amount)
  values (new.company_id, v_period, v_total)
  on conflict (company_id, period) do update set amount = excluded.amount;

  return new;
end;
$$ language plpgsql;
