-- 061: a small library of swappable photos for the deck generator. A master
-- deck marks pictures it wants swappable (alt text "IMAGE: <label>"); when a
-- deck is generated, each of those slots can be filled from this library
-- (e.g. "Outdoor mall", "Office", "Casino"). Anyone signed in can use the
-- photos; only an Owner can add or remove them.

create table deck_images (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table deck_images enable row level security;
create policy deck_images_select on deck_images for select to authenticated using (true);
create policy deck_images_insert on deck_images for insert to authenticated with check ((select my_role()) = 'owner');
create policy deck_images_update on deck_images for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy deck_images_delete on deck_images for delete to authenticated using ((select my_role()) = 'owner');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deck-images', 'deck-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy deck_images_obj_select on storage.objects for select to authenticated using (bucket_id = 'deck-images');
create policy deck_images_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deck-images' and (select my_role()) = 'owner');
create policy deck_images_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'deck-images' and (select my_role()) = 'owner');
create policy deck_images_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'deck-images' and (select my_role()) = 'owner');
