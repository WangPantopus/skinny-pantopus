-- Track exact-address sharing for email-only Support Train reservations.

ALTER TABLE "public"."SupportTrainReservation"
  ADD COLUMN IF NOT EXISTS "guest_address_shared_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "guest_address_shared_by" uuid,
  ADD COLUMN IF NOT EXISTS "guest_address_share_count" integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SupportTrainReservation_guest_address_shared_by_fkey'
  ) THEN
    ALTER TABLE "public"."SupportTrainReservation"
      ADD CONSTRAINT "SupportTrainReservation_guest_address_shared_by_fkey"
        FOREIGN KEY ("guest_address_shared_by")
        REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
END $$;
