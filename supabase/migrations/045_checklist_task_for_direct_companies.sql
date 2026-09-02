-- 045: closes a gap migration 028 left deliberately at the time — a
-- company created directly by an Owner or Strategic Partner (pending_review
-- starts false, since only a bd_consultant's insert forces it true) never
-- went through a "confirm review" transition, so it never got a
-- Pre-Install Checklist task auto-created. Justin: they still need one.
--
-- Extends the same function with an INSERT-time path: fires the moment a
-- company is created with pending_review already false (i.e. it's
-- skipping the BD-review gate entirely — Owner/Strategic-Partner-created).
-- A bd_consultant's insert always has pending_review forced true (migration
-- 015's before-insert trigger), so this never double-fires for the
-- consultant path, which still gets its task from the existing
-- true -> false UPDATE trigger below, unchanged.
create or replace function seed_pre_install_checklist_task() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.pending_review = false then
    insert into tasks (company_id, title, type, due_date, assigned_to)
    values (new.id, 'Pre-Install Checklist', 'install', current_date + 3, new.rep_id);
  elsif tg_op = 'UPDATE' and old.pending_review = true and new.pending_review = false then
    insert into tasks (company_id, title, type, due_date, assigned_to)
    values (new.id, 'Pre-Install Checklist', 'install', current_date + 3, new.rep_id);
  end if;
  return new;
end;
$$;

create trigger companies_after_insert_seed_checklist_task
  after insert on companies
  for each row execute function seed_pre_install_checklist_task();
