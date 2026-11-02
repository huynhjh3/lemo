-- 070: two code pools. WELCOME codes (10-minute) go out once, with the sign-up welcome email. BONUS codes
-- (a free 4-minute massage) go out with each monthly newsletter issue, one per subscriber who is
-- still subscribed when the issue is sent. Until now every code was a welcome code.

alter table coupon_codes
  add column kind text not null default 'welcome' check (kind in ('welcome','bonus')),
  add column issue_id uuid references newsletter_issues(id) on delete set null;   -- which issue awarded a bonus code

-- The bonus pool starts EMPTY on purpose. A code's length is fixed in the Lemo system, and every code
-- in the pool so far is a 10-minute coupon, so none of them can be sent as a "4-minute bonus". Paste a
-- real 4-minute batch into the Bonus pool (Inbox -> Newsletter) when you have one.

-- Hands out the next unused code of a kind (skip locked, so two at once can't get the same one).
-- Replaces the one-argument version; calling it with just the subscriber still means a welcome code.
drop function if exists assign_next_coupon(uuid);
create function assign_next_coupon(p_subscriber uuid, p_kind text default 'welcome', p_issue uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  update coupon_codes
     set assigned_to = p_subscriber, assigned_at = now(), issue_id = p_issue
   where id = (
     select id from coupon_codes where assigned_to is null and kind = p_kind
      order by created_at, id limit 1 for update skip locked
   )
  returning code into v_code;
  return v_code;
end;
$$;
revoke all on function assign_next_coupon(uuid, text, uuid) from public, anon, authenticated;
grant execute on function assign_next_coupon(uuid, text, uuid) to service_role;

-- If a batch of newsletters fails to send, the bonus codes picked for it go back in the pool.
create function release_bonus_codes(p_codes text[]) returns void
language sql security definer set search_path = public as $$
  update coupon_codes set assigned_to = null, assigned_at = null, issue_id = null
   where code = any(p_codes) and kind = 'bonus';
$$;
revoke all on function release_bonus_codes(text[]) from public, anon, authenticated;
grant execute on function release_bonus_codes(text[]) to service_role;

-- An Owner can move UNUSED codes between the pools (never a code that has been handed out).
create policy coupon_codes_update on coupon_codes for update to authenticated
  using ((select my_role()) = 'owner' and assigned_to is null)
  with check ((select my_role()) = 'owner' and assigned_to is null);
