-- 029: Dual-approval "checks and balances" for the most sensitive Master
-- Admin actions — a single Master Admin can no longer unilaterally turn
-- the site off for everyone, delete a person's account, or invite a new
-- Owner/Strategic Partner. A second, DIFFERENT Master Admin has to
-- approve it first.
--
-- Turning maintenance mode back ON... er, back OFF (restoring access) is
-- NOT gated — that's recovery, not risk, and gating it too would mean a
-- single absent second approver could leave the site down. Inviting a
-- Consultant or Partner isn't gated either — only Owner/Strategic Partner
-- invites (role escalation) and any account deletion need a second sign-off.
--
-- requested_by defaults to auth.uid() (like created_by on
-- pre_install_checklists) so it's never client-suppliable. approved_by is
-- NOT defaulted — it's set explicitly by whoever resolves the request,
-- and validated below to (a) actually be the caller and (b) not be the
-- original requester.
create table master_admin_approvals (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('maintenance_on', 'delete_user', 'invite_owner', 'invite_geo_partner')),
  -- delete_user: {user_id, user_name}. invite_owner/invite_geo_partner:
  -- {email, name, region}. maintenance_on: {} (nothing extra needed —
  -- maintenance_message stays independently editable, unrestricted).
  payload jsonb not null default '{}',
  requested_by uuid references profiles(id) on delete set null default auth.uid(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references profiles(id) on delete set null,
  -- Null until the gated action has actually been carried out (the
  -- manage-user Edge Function sets this for delete_user/invite_* after
  -- executing; the trigger below sets it immediately for maintenance_on).
  -- Guards against a second execution off the same approved row.
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
create index master_admin_approvals_status_idx on master_admin_approvals(status);

-- Blocks a Master Admin from approving/rejecting their own request, and
-- from spoofing approved_by as someone else — a row policy alone can't
-- express "this column must equal auth.uid() and differ from another
-- column on the same row", so this is a trigger instead (same reasoning
-- as prevent_non_owner_code_change / prevent_bd_rep_change).
create or replace function prevent_self_approval() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    if new.approved_by is null or new.approved_by <> auth.uid() then
      raise exception 'approved_by must be the acting Master Admin';
    end if;
    if new.approved_by = old.requested_by then
      raise exception 'a different Master Admin must resolve this request';
    end if;
  end if;
  return new;
end;
$$;
create trigger master_admin_approvals_before_update
  before update on master_admin_approvals
  for each row execute function prevent_self_approval();

-- maintenance_on is the one action_type simple enough to execute directly
-- in a trigger (a single-column update on a singleton row) rather than
-- needing the manage-user Edge Function — the moment a second Master
-- Admin's approval lands, the site actually goes down, atomically with
-- the approval itself. BEFORE UPDATE (not AFTER) so it can set
-- new.executed_at as part of the same write. Trigger name is
-- alphabetically after prevent_self_approval's, so Postgres fires that
-- one first — validation happens before this ever runs.
create or replace function execute_master_admin_approval() returns trigger as $$
begin
  if old.status = 'pending' and new.status = 'approved' and new.action_type = 'maintenance_on' then
    update app_settings set maintenance_mode = true;
    new.executed_at := now();
  end if;
  return new;
end;
$$ language plpgsql;
create trigger master_admin_approvals_before_update_execute
  before update on master_admin_approvals
  for each row execute function execute_master_admin_approval();

alter table master_admin_approvals enable row level security;

-- Master Admin only, in both directions — an Owner without the flag
-- shouldn't even see that a shutdown/deletion/escalation is pending.
create policy master_admin_approvals_select on master_admin_approvals for select to authenticated
  using ((select my_is_master_admin()));
create policy master_admin_approvals_insert on master_admin_approvals for insert to authenticated
  with check ((select my_is_master_admin()) and requested_by = auth.uid());
create policy master_admin_approvals_update on master_admin_approvals for update to authenticated
  using ((select my_is_master_admin()))
  with check ((select my_is_master_admin()));
