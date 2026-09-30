-- Backwards compatible: yes, once #1009 is deployed (merge and deploy it first). Revokes SELECT on
-- "PostLike" and "PostComment" from PUBLIC, anon and authenticated; service_role and the owner keep it.
-- No table, policy or row changes. With #1009 the backend reads both only through supabaseAdmin (the
-- likers list and the reply-parent check in routes/posts.js moved there; every other comment and like
-- read already used it). No web, iOS, Android or package code reads them, and no view or client-called
-- function depends on them (the invoker feed functions that read them aren't called by the app).
-- Neither table is in a Realtime publication. Writes were already closed to client roles
-- (20260930174000).
--
-- Their read policies admit every row to any caller, so anyone with the anon key alone could read
-- (reproduced on a local stack with fixture rows):
--   - PostLike (like_select_all, USING true): who liked which post, private posts included;
--   - PostComment (comment_select_all, USING is_deleted = false): every live comment, including on
--     connections-only and other non-public posts.
-- Step 2 of closing all-rows read policies (coordinator's decision; step 1 was 20260930179000).
SET LOCAL lock_timeout='5s';

REVOKE SELECT ON
  public."PostLike",
  public."PostComment"
FROM PUBLIC, anon, authenticated;
