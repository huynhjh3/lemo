-- 034: Comment thread on a note. Anyone who can see the parent note (per
-- notes_select's RLS) can read and add comments — the exists() subqueries
-- below run as the invoking user, so they're automatically scoped by
-- notes' own RLS rather than needing to be re-derived here.
--
-- Posting a comment also upserts a note_reads row for the commenter (done
-- client-side, see notes.js) — which is what lets a reply re-surface the
-- "note" HPA for the original author (a comment newer than the author's
-- own note_reads.read_at, see helpers.js) while simultaneously counting as
-- "read" for whoever just posted it.

create table note_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null default auth.uid(),
  body text not null,
  created_at timestamptz not null default now()
);
create index note_comments_note_id_idx on note_comments(note_id);

alter table note_comments enable row level security;

create policy note_comments_select on note_comments for select to authenticated
  using (exists (select 1 from notes where notes.id = note_comments.note_id));

create policy note_comments_insert on note_comments for insert to authenticated
  with check (exists (select 1 from notes where notes.id = note_comments.note_id));

create policy note_comments_update on note_comments for update to authenticated
  using ((select my_role()) = 'owner' or author_id = auth.uid())
  with check ((select my_role()) = 'owner' or author_id = auth.uid());

create policy note_comments_delete on note_comments for delete to authenticated
  using ((select my_role()) = 'owner' or author_id = auth.uid());
