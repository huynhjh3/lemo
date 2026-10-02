-- 058: Daily updates become readable by everyone, editable only by owners.
--
-- Non-owners can't be shown the live auto-written numbers: their
-- `companies` is region- or rep-scoped by RLS, so anything recomputed in
-- their browser would quietly differ from what the owner sees. Instead the
-- owner's Save now also stores `summary` — a snapshot of the auto-written
-- paragraph at the moment it was published — and everyone reads exactly
-- that, alongside the owner's typed context.
--
-- Writes stay owner-only (057's insert/update/delete policies are
-- untouched); only select opens up.

alter table daily_updates add column summary text;

drop policy daily_updates_select on daily_updates;
create policy daily_updates_select on daily_updates for select to authenticated
  using (true);
