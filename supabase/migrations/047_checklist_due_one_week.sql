-- 047: Pre-Install Checklist task now due one week after a company is
-- created, not three days — same function from migrations 028/045
-- (fires both on a bd_consultant's "confirm review" and, since 045, on
-- direct Owner/Strategic-Partner creation), only the interval changes.
create or replace function seed_pre_install_checklist_task() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.pending_review = false then
    insert into tasks (company_id, title, type, due_date, assigned_to)
    values (new.id, 'Pre-Install Checklist', 'install', current_date + 7, new.rep_id);
  elsif tg_op = 'UPDATE' and old.pending_review = true and new.pending_review = false then
    insert into tasks (company_id, title, type, due_date, assigned_to)
    values (new.id, 'Pre-Install Checklist', 'install', current_date + 7, new.rep_id);
  end if;
  return new;
end;
$$;
