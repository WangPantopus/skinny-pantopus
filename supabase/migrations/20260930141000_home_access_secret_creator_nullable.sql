-- Backwards compatible: yes. Relaxes one constraint; no function, row or API
-- change. The deployed backend and apps work the same before and after, and
-- deploy order does not matter.
--
-- Deleting an account nulls the attribution columns that point at the person
-- (DELETE /api/users/account, ACCOUNT_DELETE_NULLIFY), then deletes the User
-- row. HomeAccessSecret.created_by was NOT NULL with a plain foreign key, so
-- anyone who ever saved an access code or Wi-Fi network in a Home could not
-- delete their account: the route refuses with 409 ACCOUNT_RECORDS_RETAINED,
-- and account_deletion_dry_run reports HomeAccessSecret_created_by_fkey (or a
-- NOT NULL violation with the route's own lists). The code stays with the
-- Home; its creator becomes unknown, like HomePermissionOverride.created_by.
--
-- Every reader already handles a missing creator: home_secret_can compares the
-- creator only for a private-setup actor, where NULL fails closed; update and
-- delete run that check before mutate_home_access_secret's coalesce; the
-- private-setup and delete-eligibility checks use IS DISTINCT FROM, so a
-- former member's code counts as someone else's. No client shows the creator
-- (iOS and Android decode created_by as optional; the web doesn't read it).
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeAccessSecret" ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public."HomeAccessSecret" DROP CONSTRAINT "HomeAccessSecret_created_by_fkey";
ALTER TABLE public."HomeAccessSecret" ADD CONSTRAINT "HomeAccessSecret_created_by_fkey"
  FOREIGN KEY (created_by) REFERENCES public."User"(id) ON DELETE SET NULL;
