-- 065: the monthly newsletter ("The Recharge Report"). An Owner writes an issue
-- in CRM -> Inbox -> Newsletter issues (saved here as a draft), sends a test to
-- themselves, then sends it to every subscriber who hasn't unsubscribed. The
-- send-newsletter Edge Function does the sending (service role); everything
-- here is Owner-only. Photos go in a PUBLIC bucket because an email's images
-- have to load for people who aren't signed in.

create table newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','sending','sent')),
  recipients_count int,
  sent_at timestamptz,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index newsletter_issues_updated_idx on newsletter_issues(updated_at desc);

alter table newsletter_issues enable row level security;
create policy newsletter_issues_select on newsletter_issues for select to authenticated using ((select my_role()) = 'owner');
create policy newsletter_issues_insert on newsletter_issues for insert to authenticated with check ((select my_role()) = 'owner');
create policy newsletter_issues_update on newsletter_issues for update to authenticated
  using ((select my_role()) = 'owner' and status = 'draft') with check ((select my_role()) = 'owner');
-- A sent issue is a record; only drafts can be deleted.
create policy newsletter_issues_delete on newsletter_issues for delete to authenticated
  using ((select my_role()) = 'owner' and status = 'draft');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('newsletter-images', 'newsletter-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Public bucket: anyone can fetch an image by its URL; only an Owner can add or remove them.
create policy newsletter_images_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'newsletter-images' and (select my_role()) = 'owner');
create policy newsletter_images_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'newsletter-images' and (select my_role()) = 'owner');
create policy newsletter_images_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'newsletter-images' and (select my_role()) = 'owner');
