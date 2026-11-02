-- 069: double opt-in for the newsletter. A new sign-up gets only a "confirm your email"
-- message; their one-time code is issued (and the welcome email sent) when they click
-- the link. This stops fake or mistyped addresses, bots that never read mail, and
-- strangers' emails from being used to collect codes or send unwanted mail.
-- Unconfirmed subscribers never receive the newsletter.

alter table subscribers
  add column confirmed_at timestamptz,
  add column confirm_token uuid not null default gen_random_uuid(),  -- the secret in the confirm link
  add column confirm_sent_at timestamptz,                             -- last confirmation email (limits resends)
  add column welcome_sent_at timestamptz;                             -- last welcome email (limits resends)

-- Everyone who signed up before this change already got their code, so they count as confirmed.
update subscribers
   set confirmed_at = coalesce(consented_at, created_at),
       welcome_sent_at = coalesce(coupon_assigned_at, created_at);

create unique index subscribers_confirm_token_idx on subscribers(confirm_token);
