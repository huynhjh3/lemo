-- 066: one newsletter issue can be marked as THE welcome email. It is never sent
-- in bulk; landing-intake renders it for each new subscriber at sign-up, with
-- that subscriber's own one-time code in it. At most one issue is the welcome.

alter table newsletter_issues add column is_welcome boolean not null default false;
create unique index newsletter_issues_one_welcome on newsletter_issues ((true)) where is_welcome;
