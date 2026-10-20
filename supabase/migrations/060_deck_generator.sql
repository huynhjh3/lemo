-- 060: Deck generator. An Owner uploads a master PowerPoint once (a
-- "template"); anyone picks a company and gets a personalized copy — the
-- company name swapped in everywhere, original design untouched (done in
-- the browser, see src/lib/deckPersonalize.js). Every generated deck is
-- kept (generated_decks) so it can be re-downloaded, converted to PDF by
-- the convert-deck Edge Function, and later emailed and tracked.

create table deck_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('revenue_share','corporate_wellness')),
  -- the text in the master deck that stands in for the company name
  placeholder text not null default '{{COMPANY}}',
  storage_path text not null,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table deck_templates enable row level security;
create policy deck_templates_select on deck_templates for select to authenticated using (true);
create policy deck_templates_insert on deck_templates for insert to authenticated with check ((select my_role()) = 'owner');
create policy deck_templates_update on deck_templates for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy deck_templates_delete on deck_templates for delete to authenticated using ((select my_role()) = 'owner');

create table generated_decks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references deck_templates(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  file_name text not null,
  pptx_path text not null,
  pdf_path text,
  created_by uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index generated_decks_company_id_idx on generated_decks(company_id);

alter table generated_decks enable row level security;
-- The exists() runs as the invoking user, so it's scoped by companies' own
-- RLS — you can only see/generate decks for companies you can already see.
create policy generated_decks_select on generated_decks for select to authenticated
  using (exists (select 1 from companies where companies.id = company_id));
create policy generated_decks_insert on generated_decks for insert to authenticated
  with check (exists (select 1 from companies where companies.id = company_id));
create policy generated_decks_update on generated_decks for update to authenticated
  using (created_by = auth.uid() or (select my_role()) = 'owner')
  with check (created_by = auth.uid() or (select my_role()) = 'owner');
create policy generated_decks_delete on generated_decks for delete to authenticated
  using (created_by = auth.uid() or (select my_role()) = 'owner');

-- ---- Storage ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deck-templates', 'deck-templates', false, 52428800, array['application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-decks', 'generated-decks', false, 52428800, array['application/vnd.openxmlformats-officedocument.presentationml.presentation','application/pdf'])
on conflict (id) do nothing;

-- Templates: anyone signed in can read (the browser downloads one to
-- personalize it); only an Owner can add, replace or delete.
create policy deck_templates_obj_select on storage.objects for select to authenticated using (bucket_id = 'deck-templates');
create policy deck_templates_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deck-templates' and (select my_role()) = 'owner');
create policy deck_templates_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'deck-templates' and (select my_role()) = 'owner');
create policy deck_templates_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'deck-templates' and (select my_role()) = 'owner');

-- Generated decks: object paths are "<company_id>/<uuid>.pptx|pdf", so access
-- mirrors the company-photo bucket (migration 042) — whoever can work with
-- that company. The convert-deck function writes PDFs with the service role.
create policy generated_decks_obj_select on storage.objects for select to authenticated
  using (
    bucket_id = 'generated-decks'
    and (
      (select my_role()) = 'owner'
      or ((select my_role()) = 'geo_partner'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and region = (select my_region())))
      or ((select my_role()) = 'bd_consultant'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and rep_id = auth.uid()))
    )
  );
create policy generated_decks_obj_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'generated-decks'
    and (
      (select my_role()) = 'owner'
      or ((select my_role()) = 'geo_partner'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and region = (select my_region())))
      or ((select my_role()) = 'bd_consultant'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and rep_id = auth.uid()))
    )
  );
create policy generated_decks_obj_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'generated-decks'
    and (
      (select my_role()) in ('owner','geo_partner')
      or ((select my_role()) = 'bd_consultant'
          and exists (select 1 from companies where id = ((storage.foldername(name))[1])::uuid and rep_id = auth.uid()))
    )
  );
