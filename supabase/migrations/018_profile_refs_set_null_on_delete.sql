-- 018: five FKs reference profiles(id) without an ON DELETE behavior, which
-- defaults to blocking the delete entirely (RESTRICT/NO ACTION) — so
-- deleting a user account via the manage-user Edge Function (migration
-- 016) failed with a raw "database error deleting user" the moment that
-- user had ever done anything logged, been assigned as a rep, authored a
-- note, been assigned a task, or uploaded a CSV. Since almost every real
-- account has at least an activity_log row, this blocked deleting nearly
-- any user.
--
-- Same fix as activity_log.company_id (migration 005) for the same
-- reason: preserve history instead of letting an unrelated deletion
-- cascade-destroy it. A deleted rep's companies just go back to
-- "Unassigned" (already handled — transform.js already falls back to that
-- label for a null rep_id) rather than blocking the account deletion.
alter table companies drop constraint companies_rep_id_fkey;
alter table companies add constraint companies_rep_id_fkey
  foreign key (rep_id) references profiles(id) on delete set null;

alter table activity_log drop constraint activity_log_user_id_fkey;
alter table activity_log add constraint activity_log_user_id_fkey
  foreign key (user_id) references profiles(id) on delete set null;

alter table notes drop constraint notes_author_id_fkey;
alter table notes add constraint notes_author_id_fkey
  foreign key (author_id) references profiles(id) on delete set null;

alter table tasks drop constraint tasks_assigned_to_fkey;
alter table tasks add constraint tasks_assigned_to_fkey
  foreign key (assigned_to) references profiles(id) on delete set null;

alter table revenue_csv_uploads drop constraint revenue_csv_uploads_uploaded_by_fkey;
alter table revenue_csv_uploads add constraint revenue_csv_uploads_uploaded_by_fkey
  foreign key (uploaded_by) references profiles(id) on delete set null;
