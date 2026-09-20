-- UserBlock has no meaning after either endpoint account is deleted. Match the
-- existing UserProfileBlock/UserReport lifecycle without merging their scopes.
-- The original NO ACTION constraints prevented the existing account deletion
-- handler from deleting either a blocker or a blocked user.
-- Backwards compatible: yes. Existing block rows and API contracts are unchanged;
-- deleting either account now retires its orphaned personal blocks.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."UserBlock"
  DROP CONSTRAINT "UserBlock_blocker_user_id_fkey",
  ADD CONSTRAINT "UserBlock_blocker_user_id_fkey"
    FOREIGN KEY (blocker_user_id) REFERENCES public."User"(id) ON DELETE CASCADE,
  DROP CONSTRAINT "UserBlock_blocked_user_id_fkey",
  ADD CONSTRAINT "UserBlock_blocked_user_id_fkey"
    FOREIGN KEY (blocked_user_id) REFERENCES public."User"(id) ON DELETE CASCADE;

COMMIT;
