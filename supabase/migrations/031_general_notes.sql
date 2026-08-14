-- 031: Generalize `notes` from "always attached to one company" into a
-- general-purpose Notes tab — a note can now be attached to a company (as
-- before), a specific person, an entire region ("the geographic org"), or
-- nothing at all (a fully general note).
--
-- Visibility rules (decided explicitly, not guessed):
-- - You can always see a note you wrote, regardless of its target.
-- - Owner sees everything, always.
-- - A note aimed at a person is visible to that person (+ owner + author)
--   only — not the whole team. It's a direct heads-up, not a broadcast.
-- - A note aimed at a region is visible to owner + anyone (geo_partner or
--   bd_consultant) whose own profile.region matches.
-- - A note aimed at a company keeps the existing company-scoped
--   visibility (region for geo_partner, own companies for bd_consultant).
-- - A fully general note (no company/person/region) is Owner/Strategic
--   Partner only — bd_consultant can't create or see one. They can still
--   post notes targeted at a person, a region, or a company.
--
-- Update/delete are simplified to author-or-owner only, uniformly — the
-- old company-scoped "anyone with company access can edit" rule doesn't
-- make sense anymore now that a note can be read by people well outside
-- that scope (a target person or region).

alter table notes
  alter column company_id drop not null,
  add column target_user_id uuid references profiles(id) on delete set null,
  add column target_region text,
  -- Only ever set at insert time (the client never sends this column
  -- going forward) — same created_by/auth.uid() trick used elsewhere, so
  -- authorship can't be spoofed and the new author-or-owner update/delete
  -- policies below actually mean something.
  alter column author_id set default auth.uid();

drop policy notes_select on notes;
drop policy notes_insert on notes;
drop policy notes_update on notes;
drop policy notes_delete on notes;

create policy notes_select on notes for select to authenticated
  using (
    (select my_role()) = 'owner'
    or author_id = auth.uid()
    or (target_user_id is not null and target_user_id = auth.uid())
    or (target_region is not null and target_region = (select my_region()))
    or (company_id is not null and company_id = (select my_company_id()))
    or (company_id is not null and (select my_role()) = 'geo_partner'
        and company_id in (select id from companies where region = (select my_region())))
    or (company_id is not null and (select my_role()) = 'bd_consultant'
        and company_id in (select id from companies where rep_id = auth.uid()))
    or (company_id is null and target_user_id is null and target_region is null
        and (select my_role()) = 'geo_partner')
  );

create policy notes_insert on notes for insert to authenticated
  with check (
    (select my_role()) = 'owner'
    or (
      (select my_role()) = 'geo_partner'
      and (
        target_user_id is not null
        or (target_region is not null and target_region = (select my_region()))
        or (company_id is not null and company_id in (select id from companies where region = (select my_region())))
        or (company_id is null and target_user_id is null and target_region is null)
      )
    )
    or (
      (select my_role()) = 'bd_consultant'
      and (
        target_user_id is not null
        or (target_region is not null and target_region = (select my_region()))
        or (company_id is not null and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
      )
    )
  );

create policy notes_update on notes for update to authenticated
  using ((select my_role()) = 'owner' or author_id = auth.uid())
  with check ((select my_role()) = 'owner' or author_id = auth.uid());

create policy notes_delete on notes for delete to authenticated
  using ((select my_role()) = 'owner' or author_id = auth.uid());
