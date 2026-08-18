-- 035: Turns on Realtime (postgres_changes) replication for every table
-- the app reads into its main data hook, so the UI can auto-refresh when
-- anyone's change lands instead of requiring a manual page reload.
--
-- This only makes the *change events* available over the replication
-- publication — it does not bypass RLS. The client never reads row
-- contents off these events directly (see src/lib/realtime.js); a change
-- notification just triggers the existing RLS-scoped refetch, so a user's
-- effective visibility is unchanged either way.

alter publication supabase_realtime add table
  companies,
  contacts,
  outlets,
  devices,
  tasks,
  profiles,
  activity_log,
  showroom_bookings,
  notes,
  note_reads,
  note_comments,
  communications_log,
  pre_install_checklists,
  revenue_csv_uploads,
  revenue_entries,
  device_usage_uploads,
  master_admin_approvals,
  app_settings;
