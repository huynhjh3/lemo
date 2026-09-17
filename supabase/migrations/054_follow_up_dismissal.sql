-- 054: Bulk Follow-Up dismissal — lets someone clear a Follow-Up Detection
-- flag (scoreFollowUps, helpers.js) without faking a Communications Log
-- entry just to silence it. A dismissal acts like a "soft contact" for
-- staleness purposes only: scoreFollowUps treats follow_up_dismissed_at as
-- the reference point alongside the real last-contact/stage-entered
-- dates, so the flag naturally comes back if the company goes stale again
-- after a real contact or a stage change — it isn't a permanent mute.
--
-- No new RLS needed: these are just three more columns on a row the
-- caller could already update (companies_update, migration 015) — the UI
-- only exposes the action to whoever can already see the flag (Owner,
-- the company's own region Strategic Partner, or its own rep).

alter table companies
  add column follow_up_dismissed_at timestamptz,
  add column follow_up_dismissed_by uuid references profiles(id) on delete set null,
  add column follow_up_dismissed_reason text;
