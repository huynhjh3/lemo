-- 019: my_role()/my_company_id()/my_region()/my_is_master_admin() were
-- revoked from PUBLIC and only re-granted to `authenticated`, intended as
-- light defense-in-depth — they only ever return the caller's own
-- auth.uid()-scoped data anyway, so that bought very little.
--
-- It broke deleting a user: auth.admin.deleteUser()'s cascade sets
-- companies.rep_id to null (migration 018), which is an UPDATE that fires
-- every BEFORE/AFTER UPDATE trigger on companies — several of which call
-- my_role() (prevent_bd_rep_change, set_rep_confirmed, etc.). That cascade
-- runs as an internal Supabase role, not `authenticated`, which was never
-- granted EXECUTE — Postgres refuses with 42501 (insufficient_privilege).
grant execute on function my_role() to public;
grant execute on function my_company_id() to public;
grant execute on function my_region() to public;
grant execute on function my_is_master_admin() to public;
