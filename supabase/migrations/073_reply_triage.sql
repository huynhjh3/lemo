-- 073: reply triage. When a prospect's reply is logged (mail-intake), an AI step
-- labels it, links it to a Why-we-lose reason when it's an objection, and writes a
-- draft reply. All of it lives on the communications_log row itself, so the existing
-- RLS (owner / region geo_partner / the company's own rep) already decides who sees
-- the drafts, and the company page picks it up with the rest of the log.
--
-- Labels:   interested, question, objection, not_now, referral, unsubscribe, auto_reply, other
-- triage_label       what the AI thinks the reply is
-- triage_reason      for objections/not_now: a decline_reason id from migration 072
-- triage_summary     one line: what they actually said
-- triage_follow_up_days  for not_now: when they asked to be contacted again
-- triage_confirmed_at / _by   a person clicked "Yes, that's right" or changed the label;
--                            only confirmed labels feed the Why-we-lose chart and segment tips
-- draft_body         the AI draft reply (never sent by the CRM; the rep copies it into Gmail)
-- draft_edited       what the rep changed it to when they copied it, kept as a voice example
-- triaged_at         when the AI last ran on this entry (so "Redo" is visible)
-- Re-runnable.

alter table communications_log
  add column if not exists triage_label text,
  add column if not exists triage_reason text,
  add column if not exists triage_summary text,
  add column if not exists triage_follow_up_days integer,
  add column if not exists triage_confirmed_at timestamptz,
  add column if not exists triage_confirmed_by uuid references profiles(id) on delete set null,
  add column if not exists draft_body text,
  add column if not exists draft_edited text,
  add column if not exists triaged_at timestamptz;

alter table communications_log drop constraint if exists communications_log_triage_label_check;
alter table communications_log add constraint communications_log_triage_label_check
  check (triage_label is null or triage_label in
    ('interested','question','objection','not_now','referral','unsubscribe','auto_reply','other'));

-- The segment lookups read "confirmed objections for companies in this industry".
create index if not exists communications_log_triage_idx
  on communications_log(triage_label) where triage_label is not null;

-- Which reply a follow-up task came from, so a new reply updates the open task instead of
-- stacking another, and the task can point at the draft.
alter table tasks add column if not exists reply_log_id uuid references communications_log(id) on delete set null;
