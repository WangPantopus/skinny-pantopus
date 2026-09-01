-- Migration 188: Home.owner_id — allow NULL, and stop cascading Home deletion
--
-- Two critical findings from the 2026-08-22 audit share one root cause:
-- `Home.owner_id` is NOT NULL with ON DELETE CASCADE.
--
-- LIF-01. Because the column cannot be cleared, no leave path clears it.
--   `checkHomePermission` treats `Home.owner_id === userId` as legacy ownership
--   (utils/homePermissions.js), so a user who moves out — or removes
--   themselves via DELETE /:id/members/:self, where the owner guard is
--   explicitly disabled for self — keeps full administrative control of the
--   home forever, including the ability to delete it.
--
-- LIF-02. Because the FK cascades, deleting the owner's User row deletes the
--   Home, and with it every other resident's occupancy, verification history,
--   audit log and residency letters. Account deletion pre-checks exist for
--   gigs and escrow but not for homes, so this is reachable by any owner
--   deleting their own account.
--
-- Making the column nullable lets a home outlive its original owner and lets
-- move-out actually revoke ownership. Readers already tolerate a null
-- owner_id (they fall back to the HomeOwner table, which is the real
-- ownership record).

BEGIN;

ALTER TABLE "public"."Home"
  ALTER COLUMN "owner_id" DROP NOT NULL;

ALTER TABLE ONLY "public"."Home"
  DROP CONSTRAINT IF EXISTS "Home_owner_id_fkey";

ALTER TABLE ONLY "public"."Home"
  ADD CONSTRAINT "Home_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "public"."User"("id") ON DELETE SET NULL;

-- Clear the legacy pointer for anyone who has already moved out. Their
-- occupancy is inactive, so they should not still be a legacy owner.
UPDATE "public"."Home" h
   SET "owner_id" = NULL
 WHERE h."owner_id" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "public"."HomeOccupancy" o
      WHERE o."home_id" = h."id"
        AND o."user_id" = h."owner_id"
        AND o."is_active" = true
   )
   AND NOT EXISTS (
     SELECT 1 FROM "public"."HomeOwner" w
      WHERE w."home_id" = h."id"
        AND w."subject_type" = 'user'
        AND w."subject_id" = h."owner_id"
        AND w."owner_status" = 'verified'
   );

COMMIT;
