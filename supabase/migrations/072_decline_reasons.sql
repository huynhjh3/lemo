-- 072: "Why we lose". When a company lands in Stay in Contact we record WHY (a short
-- pick list plus an optional one-line note) so the Pipeline can show patterns by
-- industry. Reps set it on their own companies, Owners on any (the existing
-- companies_update policy already scopes that; these are plain columns).
--   no_response is filled in automatically when the CRM auto-moves a silent deal.
--   Moving a company OUT of Stay in Contact clears the reason, so a second decline
--   starts fresh.

-- Migration 056's columns (usage-cliff acknowledgment + auto-stall receipt). The app already
-- reads and writes them; if 056 was never run they're missing, so add them here safely.
alter table companies
  add column if not exists usage_cliff_ack_at timestamptz,
  add column if not exists usage_cliff_ack_by uuid references profiles(id) on delete set null,
  add column if not exists usage_cliff_ack_note text,
  add column if not exists usage_cliff_ack_last_seen date,
  add column if not exists auto_stalled_at timestamptz;

alter table companies
  add column decline_reason text check (decline_reason in (
    'aesthetics','flat_no','has_vendor','cost','landlord','timing','placement','no_response','other'
  )),
  add column decline_note text,
  add column declined_at timestamptz;

create or replace function companies_decline_housekeeping() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.stage = 'Stay in Contact' and old.stage is distinct from 'Stay in Contact' then
    new.declined_at := coalesce(new.declined_at, now());
  end if;
  if old.stage = 'Stay in Contact' and new.stage is distinct from 'Stay in Contact' then
    new.decline_reason := null;
    new.decline_note := null;
    new.declined_at := null;
  end if;
  -- The CRM's own "went silent" auto-move is always a no-response.
  if new.stage = 'Stay in Contact' and new.auto_stalled_at is not null
     and new.auto_stalled_at is distinct from old.auto_stalled_at and new.decline_reason is null then
    new.decline_reason := 'no_response';
  end if;
  return new;
end;
$$;

create trigger companies_decline_housekeeping
  before update on companies
  for each row execute function companies_decline_housekeeping();

-- Companies the CRM already auto-moved for silence.
update companies
set decline_reason = 'no_response', declined_at = coalesce(auto_stalled_at, now())
where stage = 'Stay in Contact' and auto_stalled_at is not null and decline_reason is null;
