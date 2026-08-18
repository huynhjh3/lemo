-- 040: Lets any user save their own custom prospecting intro template
-- (AIPage.jsx's "Add as Lead & Draft Intro") instead of everyone sharing
-- one fixed template — a no-API way to get some personalization, since
-- true per-company AI-adapted drafting needs an LLM (see
-- project_lemocrm_ai_assistant memory).
--
-- No new RLS policy needed: profiles_update_self (schema.sql) already
-- lets a user update their own row, and prevent_self_role_change only
-- blocks role/company_id/region/is_master_admin — this column isn't one
-- of those, so it's freely self-editable already.

alter table profiles add column intro_template text;
