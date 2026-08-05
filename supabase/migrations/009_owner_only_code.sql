-- 009: only an owner can set or change a company's code.
--
-- RLS is row-level, not column-level, so "owner and bd_consultant can both
-- insert/update companies, but only owner can touch the code column"
-- can't be expressed as a row policy alone — same reason
-- prevent_self_role_change() (profiles.role/company_id) is a trigger rather
-- than folded into a policy.
create or replace function prevent_non_owner_code_change() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if (select my_role()) <> 'owner' then
    if tg_op = 'INSERT' and new.code is not null then
      raise exception 'only an owner can set a company''s code';
    elsif tg_op = 'UPDATE' and new.code is distinct from old.code then
      raise exception 'only an owner can change a company''s code';
    end if;
  end if;
  return new;
end;
$$;

create trigger companies_before_insert_or_update_code
  before insert or update on companies
  for each row execute function prevent_non_owner_code_change();
