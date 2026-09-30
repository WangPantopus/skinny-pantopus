-- Backwards compatible: yes. Revokes EXECUTE on ten SECURITY DEFINER functions from
-- PUBLIC, anon and authenticated. service_role and postgres keep their explicit grants;
-- no function body, table, policy or row changes. The backend calls nine of them through
-- supabaseAdmin (service_role) and never calls increment_unread_count or
-- get_full_home_profile; the tenth, toggle_listing_save, moves to supabaseAdmin in the same
-- change (routes/listings.js). No app calls PostgREST.
--
-- PostgREST exposes every function a role can execute as /rest/v1/rpc/<name>, and a
-- SECURITY DEFINER function runs as its owner, past row-level security. These ten take a
-- user, room, mail or home id from the caller instead of the signed-in identity, so with
-- only the anon key and no sign-in, anyone could (reproduced on a local stack with fixture
-- data; counts and field names recorded, never content):
--   - read any person's chat list with message previews and the other person's name
--     (get_user_chat_rooms), or any Home's profile with its members (get_full_home_profile);
--   - open direct chats between any two people, create any task's chat room, raise anyone's
--     unread count (get_or_create_direct_chat, get_or_create_gig_chat, increment_unread_count);
--   - open, close and mark mail read sessions for anyone (open_mail_read_session,
--     close_mail_read_session, mark_mail_viewed);
--   - save or unsave posts and listings for anyone (toggle_post_save, toggle_listing_save).
-- The boolean helpers that row-level-security policies call (is_home_member,
-- has_home_permission, home_member_can, home_bill_has_finance_permission) stay executable.
SET LOCAL lock_timeout='5s';

REVOKE EXECUTE ON FUNCTION
  public.get_user_chat_rooms(uuid, integer),
  public.get_or_create_direct_chat(uuid, uuid),
  public.get_or_create_gig_chat(uuid),
  public.increment_unread_count(uuid, uuid),
  public.get_full_home_profile(uuid),
  public.open_mail_read_session(uuid, uuid, jsonb),
  public.close_mail_read_session(uuid, uuid, integer, numeric, jsonb),
  public.mark_mail_viewed(uuid, uuid),
  public.toggle_post_save(uuid, uuid),
  public.toggle_listing_save(uuid, uuid)
FROM PUBLIC, anon, authenticated;
