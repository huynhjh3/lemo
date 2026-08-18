-- 037: A company's stage can't become 'Installed' until its Pre-Install
-- Checklist is actually done — approved by an Owner (the normal path) or
-- explicitly bypassed (the Owner override that already skips completion
-- entirely — see migration 026 and helpers.js's highPriorityActions,
-- which already treats bypass as an equivalent terminal state to
-- completed/approved, not a lesser one). Enforced as a trigger, not just a
-- client-side check, matching how every other real business rule in this
-- app is enforced (RLS/triggers are the source of truth; the UI is just
-- the friendly path) — a direct API call can't skip this either.
--
-- Only fires on the transition INTO 'Installed' (old.stage distinct from
-- 'Installed', or a brand-new insert) — a later edit to an
-- already-Installed company (e.g. updating deal_value) doesn't re-check.
-- A brand-new company can never satisfy this (no task can reference a
-- company that didn't exist a moment ago), so this also blocks creating a
-- company pre-set to Installed — the "New Company" form's stage picker no
-- longer offers that option to match.

create or replace function check_install_stage_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage = 'Installed' and (TG_OP = 'INSERT' or old.stage is distinct from 'Installed') then
    if not exists (
      select 1 from tasks t
      join pre_install_checklists p on p.task_id = t.id
      where t.company_id = new.id and t.type = 'install'
        and (p.approved_for_install_at is not null or p.bypassed_at is not null)
    ) then
      raise exception 'Complete and approve this company''s Pre-Install Checklist before moving it to Installed.';
    end if;
  end if;
  return new;
end;
$$;

create trigger companies_install_stage_gate
  before insert or update on companies
  for each row execute function check_install_stage_gate();
