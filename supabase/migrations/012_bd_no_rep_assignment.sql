-- 012: only an owner or geo_partner may assign/change a company's rep_id —
-- a bd_consultant can no longer self-assign (or reassign) when creating or
-- editing a company. Same "trigger, not RLS" shape as
-- prevent_non_owner_code_change (migration 009) and set_rep_confirmed
-- (migration 011), since RLS is row-level, not column-level.
create or replace function prevent_bd_rep_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) = 'bd_consultant' then
    if tg_op = 'INSERT' and new.rep_id is not null then
      raise exception 'only an owner or geo_partner can assign a company''s rep';
    elsif tg_op = 'UPDATE' and new.rep_id is distinct from old.rep_id then
      raise exception 'only an owner or geo_partner can change a company''s rep';
    end if;
  end if;
  return new;
end;
$$;

create trigger companies_before_insert_or_update_rep
  before insert or update on companies
  for each row execute function prevent_bd_rep_change();
