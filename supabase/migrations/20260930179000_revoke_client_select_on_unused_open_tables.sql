-- Backwards compatible: yes. Revokes SELECT on three tables from PUBLIC, anon and authenticated;
-- service_role and the owner keep it. No table, policy or row changes. The backend reads and
-- writes them only through supabaseAdmin (the transaction-review routes, the reputation service
-- and its job); nothing reads FileThumbnail; no web or package code reads any of them, and no app
-- reaches PostgREST directly. Writes were already closed to client roles (20260930174000).
--
-- Their read policies admit every row to any caller (USING true), so anyone with the anon key
-- alone could read (reproduced on a local stack with fixture rows; counts only):
--   - TransactionReview: every review with reviewer, reviewed person, rating and comment;
--   - ReputationScore: every person's ratings, sales, completion rate and response time;
--   - FileThumbnail: the stored path and URL of every file's thumbnail, private files included.
-- Step 1 of closing all-rows read policies (coordinator's decision). PostComment and PostLike stay
-- until the posts routes read them through supabaseAdmin with explicit visibility checks.
SET LOCAL lock_timeout='5s';

REVOKE SELECT ON
  public."FileThumbnail",
  public."TransactionReview",
  public."ReputationScore"
FROM PUBLIC, anon, authenticated;
