-- 023: Replace the two free-text "date or date range" / "time window"
-- fields with real date/time inputs — matching required_completion_date's
-- box instead of asking a BD consultant to type a date out by hand.
alter table pre_install_checklists
  drop column preferred_install_window,
  drop column install_time_window,
  add column preferred_install_start date,
  add column preferred_install_end date,
  add column install_time_start time,
  add column install_time_end time;
