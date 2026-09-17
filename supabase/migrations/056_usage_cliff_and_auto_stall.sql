-- 056: Two "the CRM works for itself" additions.
--
-- 1. Usage-cliff acknowledgment: a chair that goes quiet for real reasons
-- (down for maintenance, venue closed for a few days) shouldn't nag
-- forever once someone's confirmed why — usage_cliff_ack_last_seen stores
-- the chair's last-activity date at the moment it was acknowledged, and
-- helpers.js's usageCliffAlerts() stays quiet as long as that date hasn't
-- changed (i.e. nothing new has happened since the explanation was
-- given). The moment real new usage data comes in, the alert logic
-- re-evaluates fresh.
--
-- 2. Auto-stall: auto_stalled_at marks a company the client-side check in
-- useCrmData.js moved to "Stay in Contact" on its own (severely stalled —
-- 3x typical stage duration AND real silence, not just "been a while").
-- One-way marker, not itself re-checked — this is a "the CRM cleaned this
-- up" receipt for the UI to show, not a workflow state.
--
-- No RLS changes needed — both are just more columns on a row the caller
-- (whoever's `companies_update` policy already covers) could already
-- write.

alter table companies
  add column usage_cliff_ack_at timestamptz,
  add column usage_cliff_ack_by uuid references profiles(id) on delete set null,
  add column usage_cliff_ack_note text,
  add column usage_cliff_ack_last_seen date,
  add column auto_stalled_at timestamptz;
