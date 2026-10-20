-- 062: a record of every deck emailed from the CRM (the send-deck Edge
-- Function writes these after Resend accepts the message). Foundation for
-- tracking: resend_id lets a later webhook fill in opened_at / clicked_at.

create table deck_emails (
  id uuid primary key default gen_random_uuid(),
  generated_deck_id uuid not null references generated_decks(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  to_email text not null,
  subject text not null,
  resend_id text,
  sent_by uuid references profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  clicked_at timestamptz
);
create index deck_emails_deck_idx on deck_emails(generated_deck_id);
create index deck_emails_company_idx on deck_emails(company_id);
create index deck_emails_resend_idx on deck_emails(resend_id);

alter table deck_emails enable row level security;
-- Readable by anyone who can already see the company (companies' own RLS
-- applies inside the exists()). No insert/update policy on purpose: only
-- the Edge Function (service role) writes these.
create policy deck_emails_select on deck_emails for select to authenticated
  using (exists (select 1 from companies where companies.id = company_id));
