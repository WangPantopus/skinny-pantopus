-- Backwards compatible: yes. Deletes only ChatParticipant rows that the chat
-- routes and socket already refuse once PR #908 is deployed; nothing reads a
-- removed row, and before #908 the removal only ends that same unwanted access.
-- No table, column or function changes. Apply after the backend with #908.
--
-- A task's gig chat room is the owner's and the accepted worker's
-- conversation once the task is assigned. People who joined earlier (a
-- pre-bid question while the task was open, or "Send Message" before
-- GET /api/gigs/:gigId/chat-room stopped adding them in PR #899) kept a
-- membership row, so they could read the room and showed up in its member
-- list. This removes those rows; their earlier messages stay in the room.
--
-- Kept: the task owner and the accepted worker. Skipped for review: tasks
-- whose owner or worker is a business account, where team members can act
-- for the business (#908 already refuses anyone else). Unchanged: open tasks
-- (no accepted worker) and every non-gig room. Idempotent: a second run
-- deletes nothing.
SET LOCAL lock_timeout='5s';

DELETE FROM public."ChatParticipant" AS p
USING public."ChatRoom" AS r,
      public."Gig" AS g,
      public."User" AS owner_user,
      public."User" AS worker_user
WHERE r.id = p.room_id
  AND r.type = 'gig'
  AND g.id = r.gig_id
  AND g.accepted_by IS NOT NULL
  AND owner_user.id = g.user_id
  AND worker_user.id = g.accepted_by
  AND owner_user.account_type IS DISTINCT FROM 'business'
  AND worker_user.account_type IS DISTINCT FROM 'business'
  AND p.user_id <> g.user_id
  AND p.user_id <> g.accepted_by;
