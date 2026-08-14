-- 033: A Consultant (bd_consultant) posting a person-targeted note can now
-- only target an Owner or Strategic Partner (geo_partner) — not another
-- Consultant or a Partner. Only narrows the target_user_id branch of the
-- notes_insert policy; region and company targeting for bd_consultant are
-- unchanged. (The UI's person picker is narrowed to match in NotesPage.jsx
-- — this is the enforcement backstop.)

drop policy notes_insert on notes;

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
        (target_user_id is not null and target_user_id in (select id from profiles where role in ('owner', 'geo_partner')))
        or (target_region is not null and target_region = (select my_region()))
        or (company_id is not null and company_id in (select id from companies where rep_id = auth.uid() and pending_review = false))
      )
    )
  );
