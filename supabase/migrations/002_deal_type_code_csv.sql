-- 002: company code + deal type (Enterprise vs Revenue Share) + CSV-driven
-- revenue for revenue-share deals. Run this once in the Supabase SQL editor
-- against the project that already has schema.sql applied.

alter table companies add column code text;
alter table companies add constraint companies_code_key unique (code);

alter table companies add column deal_type text not null default 'enterprise'
  check (deal_type in ('revenue_share','enterprise'));

-- deal_value means $ (monthly) for enterprise, % (0-100) of revenue for revenue_share.
alter table companies add constraint companies_deal_value_pct_check
  check (deal_type <> 'revenue_share' or (deal_value >= 0 and deal_value <= 100));

-- Revenue-share revenue now comes from CSV uploads (see revenue_csv_uploads
-- below), not this seed — only enterprise deals get a flat monthly amount
-- seeded the moment they become Installed.
create or replace function seed_revenue_on_installed() returns trigger as $$
begin
  if new.stage = 'Installed' and new.deal_type = 'enterprise'
     and (tg_op = 'INSERT' or old.stage is distinct from new.stage) then
    insert into revenue_entries (company_id, period, amount)
    values (new.id, date_trunc('month', current_date)::date, new.deal_value)
    on conflict (company_id, period) do nothing;
  end if;
  return new;
end;
$$ language plpgsql;

-- ============== revenue_csv_uploads ==============
-- One row per company per day, from the daily backend CSV export. `amount`
-- is our computed share (gross_revenue * deal_value/100) for revenue_share
-- companies. Upserting on (company_id, upload_date) makes re-uploading a
-- day you've already done a correction rather than a duplicate.
create table revenue_csv_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  upload_date date not null,
  gross_revenue numeric(12,2) not null,
  amount numeric(12,2) not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, upload_date)
);
create index revenue_csv_uploads_company_id_idx on revenue_csv_uploads(company_id);

alter table revenue_csv_uploads enable row level security;
create policy revenue_csv_uploads_internal on revenue_csv_uploads for all to authenticated
  using ((select my_role()) in ('owner','bd_consultant'))
  with check ((select my_role()) in ('owner','bd_consultant'));

-- Recomputes the month's revenue_entries.amount as the sum of that company's
-- daily upload rows for the month, every time a day is inserted or corrected.
-- This is what makes re-uploading the same day idempotent instead of additive.
create or replace function sync_revenue_entry_from_csv() returns trigger as $$
declare
  v_period date := date_trunc('month', new.upload_date)::date;
  v_total numeric(12,2);
begin
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

create trigger revenue_csv_uploads_after_change
  after insert or update on revenue_csv_uploads
  for each row execute function sync_revenue_entry_from_csv();
