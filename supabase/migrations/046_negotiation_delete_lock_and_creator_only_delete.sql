-- 046: two independent changes bundled from the same request.
--
-- 1. Once a company reaches Negotiation (or beyond — Installed, Stay in
-- Contact), it can never be deleted, by ANY role including Owner — same
-- "applies to everyone, no override" shape as the Installed-stage gate
-- (migration 037's check_install_stage_gate). A real safety guardrail: a
-- deal that far along is real business history, not something a stray
-- click should be able to erase.
create or replace function prevent_delete_past_negotiation() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if old.stage in ('Negotiation', 'Installed', 'Stay in Contact') then
    raise exception 'Cannot delete "%" — it has already reached % stage', old.name, old.stage;
  end if;
  return old;
end;
$$;

create trigger companies_before_delete_stage_gate
  before delete on companies
  for each row execute function prevent_delete_past_negotiation();

-- 2. Owner keeps deleting any company (unchanged). A Strategic Partner is
-- now restricted to deleting only companies THEY personally created —
-- narrowed from "any company in my region" (migration 013). created_by is
-- a plain `default auth.uid()` column, the same non-enforced-by-trigger
-- convention already used for notes.author_id / communications_log.
-- created_by / pre_install_checklists.created_by — this app has never
-- needed spoof-proofing on these (small trusted team), and this one is no
-- different. Existing rows backfill to null (nobody "created" them under
-- this new tracking), which means a Strategic Partner can no longer
-- delete any company that existed before this migration — expected, not
-- a bug: there's no real record of who created those.
alter table companies add column created_by uuid references profiles(id) on delete set null default auth.uid();

drop policy companies_delete on companies;
create policy companies_delete on companies for delete to authenticated
  using (
    (select my_role()) = 'owner'
    or ((select my_role()) = 'geo_partner' and created_by = auth.uid())
  );
