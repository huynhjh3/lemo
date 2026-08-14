-- 032: Per-user read tracking for notes ("mark as read"). One row per
-- (note, user) — read_at is the last time that user acknowledged the
-- note's thread. Used two ways:
-- - A person/region-targeted note stays in the recipient's High Priority
--   Actions list until they have a read_reads row for it (see helpers.js).
-- - A reply on a note (migration 034) re-surfaces that HPA for the note's
--   author if the reply is newer than their own read_at for that note.
-- Upserted (on conflict do update), not just inserted, since reopening a
-- note you've already read just bumps read_at.

create table note_reads (
  note_id uuid not null references notes(id) on delete cascade,
  -- Same tamper-proof default-only trick as notes.author_id: the client
  -- never sends user_id, so it can't be spoofed to mark a note read for
  -- someone else.
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

alter table note_reads enable row level security;

create policy note_reads_select on note_reads for select to authenticated
  using (user_id = auth.uid());

-- The exists() below runs as the invoking user, so it's automatically
-- filtered by notes' own notes_select RLS — you can only mark-read a note
-- you're actually allowed to see.
create policy note_reads_insert on note_reads for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from notes where notes.id = note_id)
  );

create policy note_reads_update on note_reads for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
