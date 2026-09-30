-- Backwards compatible: yes. Makes one column nullable and changes its foreign
-- key's delete rule; no rows change when this is applied. Existing rows keep
-- their actor. The deployed backend always writes an actor, and the web's
-- Activity views already handle a missing one.
--
-- BusinessAuditLog.actor_user_id was NOT NULL with no ON DELETE rule, so
-- anyone who ever acted in a business (for example a team member who changed
-- a role) could never delete their account. DELETE /api/users/account tried
-- to set the column to NULL and failed, and since #931 it refuses with 409
-- ACCOUNT_RECORDS_RETAINED instead.
--
-- Now the entry stays in the business's activity log and the actor is set to
-- NULL when their account is deleted, shown as "Former member". This is how
-- the same table's actor_seat_id already works (ON DELETE SET NULL).
SET LOCAL lock_timeout='5s';

ALTER TABLE public."BusinessAuditLog"
  ALTER COLUMN actor_user_id DROP NOT NULL,
  DROP CONSTRAINT "BusinessAuditLog_actor_user_id_fkey",
  ADD CONSTRAINT "BusinessAuditLog_actor_user_id_fkey"
    FOREIGN KEY (actor_user_id) REFERENCES public."User"(id) ON DELETE SET NULL;
