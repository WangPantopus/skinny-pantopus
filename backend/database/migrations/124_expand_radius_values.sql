-- Align persisted radius fields with the expanded app radius options.
-- 25000 miles represents the app's Global radius option.

ALTER TABLE "public"."UserViewingLocation"
  DROP CONSTRAINT IF EXISTS "UserViewingLocation_radius_chk";

ALTER TABLE "public"."UserViewingLocation"
  ALTER COLUMN "radius_miles" SET DEFAULT 100,
  ADD CONSTRAINT "UserViewingLocation_radius_chk"
    CHECK ("radius_miles" = ANY (ARRAY[1, 3, 10, 25, 100, 1000, 25000]));

ALTER TABLE "public"."UserRecentLocation"
  ALTER COLUMN "radius_miles" SET DEFAULT 100;

ALTER TABLE "public"."Gig"
  ALTER COLUMN "radius_miles" TYPE numeric(8,2),
  ALTER COLUMN "radius_miles" SET DEFAULT 100;

ALTER TABLE "public"."Listing"
  ALTER COLUMN "radius_miles" TYPE numeric(8,2),
  ALTER COLUMN "radius_miles" SET DEFAULT 100;

ALTER TABLE "public"."Post"
  ALTER COLUMN "radius_miles" TYPE numeric(8,2);
