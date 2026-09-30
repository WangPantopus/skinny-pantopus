-- Backwards compatible: yes. Revokes all privileges on six views from PUBLIC, anon and
-- authenticated; service_role and the owner keep theirs. No view, table, policy or row
-- changes. No backend route, job, web or native code reads these views as a client: the
-- persona routes read PersonaFollow through supabaseAdmin, and nothing reads the other five.
-- No app reaches PostgREST directly.
--
-- These views have no security_invoker, so they run with their owner's rights and ignore the
-- row-level security of the tables under them. anon and authenticated could SELECT them, so
-- anyone with the anon key alone could read (reproduced on a local stack; counts and field
-- names recorded, never values):
--   - GigPublic: every task, including assigned ones, with the worker (accepted_by), creator,
--     beneficiary and origin Home/place ids - against the rule that strangers get no worker
--     identity (Stream 2 agreed to this revoke);
--   - MailAnalyticsSummary: every letter's view and read-time analytics, across all users
--     (Stream 4 agreed);
--   - PersonaFollow, PublicAudienceProfileView, PublicBroadcastMessageView,
--     PublicLocalProfileView: persona and Beacon data, a launch cut. Closed at the database
--     level only, per the coordinator; the features themselves are not touched.
-- active_sports_events is public sports data and stays readable.
SET LOCAL lock_timeout='5s';

REVOKE ALL ON
  public."GigPublic",
  public."MailAnalyticsSummary",
  public."PersonaFollow",
  public."PublicAudienceProfileView",
  public."PublicBroadcastMessageView",
  public."PublicLocalProfileView"
FROM PUBLIC, anon, authenticated;
