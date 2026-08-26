-- 042: lets a Communications Log entry carry up to 2 photos (screenshots,
-- signage, etc.) — compressed client-side before upload (see
-- src/lib/images.js), stored in a private Storage bucket, referenced by
-- path from the new photo_urls column (despite the name, these are storage
-- paths, not public URLs — the bucket is private, so every read goes
-- through a signed URL request that itself passes through the SELECT
-- policy below, same as every other access in this app).

alter table communications_log add column photo_urls text[] not null default '{}';
alter table communications_log add constraint communications_log_photo_cap
  check (coalesce(array_length(photo_urls, 1), 0) <= 2);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('communications-log-photos', 'communications-log-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Object paths are "<company_id>/<uuid>.jpg" — storage.foldername(name)
-- pulls the company_id back out as the first path segment, so access
-- mirrors communications_log's own RLS exactly (same predicates as
-- migration 030), rather than trusting the client to only ever request
-- paths it's allowed to see.
create policy communications_log_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'communications-log-photos'
    and (
      (select my_role()) = 'owner'
      or ((select my_role()) = 'geo_partner'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and region = (select my_region())))
      or ((select my_role()) = 'bd_consultant'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and rep_id = auth.uid()))
    )
  );

create policy communications_log_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'communications-log-photos'
    and (
      (select my_role()) = 'owner'
      or ((select my_role()) = 'geo_partner'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and region = (select my_region())))
      or ((select my_role()) = 'bd_consultant'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and rep_id = auth.uid() and pending_review = false))
    )
  );

-- Delete matches communications_log_delete (migration 030): unconditional
-- for owner/geo_partner (cascade-safety exception, same rationale as every
-- other child table), scoped to own companies for bd_consultant.
create policy communications_log_photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'communications-log-photos'
    and (
      (select my_role()) in ('owner','geo_partner')
      or ((select my_role()) = 'bd_consultant'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and rep_id = auth.uid()))
    )
  );
