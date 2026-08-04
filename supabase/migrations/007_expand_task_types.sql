-- 007: allow the full set of interaction types on tasks (not just
-- call/email/meeting), matching activity_log's type set minus 'system'
-- (which is audit-only, never user-selectable).
--
-- This merges Activity Timeline's type dropdown into the Task dropdown —
-- Activity Timeline's manual "Log activity" form no longer offers a type
-- picker at all (defaults to 'note'); logging a call/email/meeting/install
-- now happens by creating a task of that type instead.
alter table tasks drop constraint tasks_type_check;
alter table tasks add constraint tasks_type_check
  check (type in ('call','email','meeting','install','note'));
