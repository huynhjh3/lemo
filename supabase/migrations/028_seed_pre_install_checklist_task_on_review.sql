-- 028: Auto-create the Pre-Install Checklist task the moment an owner (or
-- that region's Strategic Partner) confirms a company's review — instead
-- of a BD consultant having to remember to create an Install-type task
-- themselves. Same shape as seed_revenue_on_installed: a trigger that
-- inserts into a different table off a companies UPDATE. The task itself
-- immediately surfaces as a "Pre-Install Checklist" High Priority Action
-- (helpers.js already flags any type='install' task without a completed/
-- bypassed checklist) — no separate HPA wiring needed, just the task
-- existing is enough.
--
-- Only fires on the true -> false transition (the actual "confirm review"
-- action) — a company that never went through pending_review (owner/
-- geo_partner-created) doesn't get one seeded, since there's no
-- "approval" moment for it to hang off of.
--
-- security definer: inserts into a different table (tasks), so it needs
-- to run with the owner's privileges regardless of which role fired the
-- update on companies — see the note above log_activity_audit.
create or replace function seed_pre_install_checklist_task() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if old.pending_review = true and new.pending_review = false then
    insert into tasks (company_id, title, type, due_date, assigned_to)
    values (new.id, 'Pre-Install Checklist', 'install', current_date + 3, new.rep_id);
  end if;
  return new;
end;
$$;

create trigger companies_after_update_seed_checklist_task
  after update on companies
  for each row execute function seed_pre_install_checklist_task();
