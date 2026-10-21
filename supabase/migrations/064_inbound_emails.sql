-- 064: mail read from the shared CRM mailbox (lemowellness@gmail.com).
-- A Google Apps Script in that mailbox posts every new message to the
-- mail-intake Edge Function (service role). A reply from a known contact is
-- logged straight onto its company's Communications Log; anything the CRM
-- can't place waits here for an Owner to assign it from Inbox -> Replies.
-- message_id is Gmail's own id, so a message that's posted twice is stored once.

create table inbound_emails (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  direction text not null check (direction in ('inbound','outbound')),
  from_email text not null,
  from_name text,
  to_emails text,
  subject text,
  snippet text,
  received_at timestamptz not null default now(),
  status text not null default 'unmatched' check (status in ('logged','unmatched','duplicate','dismissed')),
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inbound_emails_status_idx on inbound_emails(status, received_at desc);

alter table inbound_emails enable row level security;
create policy inbound_emails_select on inbound_emails for select to authenticated using ((select my_role()) = 'owner');
create policy inbound_emails_update on inbound_emails for update to authenticated
  using ((select my_role()) = 'owner') with check ((select my_role()) = 'owner');
create policy inbound_emails_delete on inbound_emails for delete to authenticated using ((select my_role()) = 'owner');
