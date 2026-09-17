-- 053: Add an installation address to the Pre-Install Checklist, and lock
-- the checklist from further edits once it's been submitted for
-- installation.
--
-- Address wasn't on the checklist originally because it used to hang off
-- an outlet, which already has one (see migration 021's comment) — but
-- migration 027 moved the checklist onto tasks specifically so it can be
-- filled out *before* any outlet/Location exists yet, so there's no
-- outlet.address to reuse. It needs its own field.
--
-- Locking: before this, upsertPreInstallChecklist reset
-- submitted_for_install_at/approved_for_install_at/etc back to null on
-- every single save (see migration 021's comment on completed_at) — so
-- editing a checklist after submission silently un-submitted/un-approved
-- it instead of being blocked. This trigger blocks any further change to
-- the checklist's actual data (including the new address field) once
-- submitted_for_install_at is set. Approving is unaffected — it only ever
-- touches approved_for_install_at/approved_by, neither of which this
-- trigger watches.

alter table pre_install_checklists add column address text;

create or replace function prevent_checklist_edit_after_submit() returns trigger
language plpgsql as $$
begin
  if old.submitted_for_install_at is not null and (
    new.address is distinct from old.address
    or new.preferred_install_start is distinct from old.preferred_install_start
    or new.preferred_install_end is distinct from old.preferred_install_end
    or new.required_completion_date is distinct from old.required_completion_date
    or new.install_time_start is distinct from old.install_time_start
    or new.install_time_end is distinct from old.install_time_end
    or new.deadline_flexible is distinct from old.deadline_flexible
    or new.deadline_event_details is distinct from old.deadline_event_details
    or new.available_space is distinct from old.available_space
    or new.chair_arrangement is distinct from old.chair_arrangement
    or new.floor_access is distinct from old.floor_access
    or new.outlets_near_chairs is distinct from old.outlets_near_chairs
    or new.photos_link is distinct from old.photos_link
    or new.delivery_access is distinct from old.delivery_access
    or new.site_requirements is distinct from old.site_requirements
    or new.site_requirements_other is distinct from old.site_requirements_other
    or new.access_instructions is distinct from old.access_instructions
    or new.early_receipt is distinct from old.early_receipt
    or new.additional_notes is distinct from old.additional_notes
    or new.completed_at is distinct from old.completed_at
    or new.submitted_for_install_at is distinct from old.submitted_for_install_at
    or new.submitted_by is distinct from old.submitted_by
  ) then
    raise exception 'This checklist was already submitted for installation and can no longer be edited.';
  end if;
  return new;
end;
$$;

create trigger pre_install_checklists_lock_after_submit
  before update on pre_install_checklists
  for each row execute function prevent_checklist_edit_after_submit();
