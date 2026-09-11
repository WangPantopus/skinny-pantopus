-- ============================================================
-- Migration: Add seat_id to BusinessPermissionOverride & BusinessAuditLog
-- Supports Identity Firewall: overrides keyed by seat, audit logs with seat actor
-- ============================================================
-- Idempotent: safe to re-run

-- ─── BusinessPermissionOverride: add seat_id ────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'BusinessPermissionOverride'
      AND column_name  = 'seat_id'
  ) THEN
    ALTER TABLE "public"."BusinessPermissionOverride"
      ADD COLUMN "seat_id" uuid REFERENCES "public"."BusinessSeat"("id") ON DELETE CASCADE;

    -- Index for seat-based override lookups
    CREATE INDEX IF NOT EXISTS idx_bpo_seat
      ON "public"."BusinessPermissionOverride" ("business_user_id", "seat_id")
      WHERE "seat_id" IS NOT NULL;

    -- Backfill seat_id from SeatBinding where possible
    UPDATE "public"."BusinessPermissionOverride" bpo
      SET "seat_id" = sb."seat_id"
      FROM "public"."SeatBinding" sb
      INNER JOIN "public"."BusinessSeat" bs ON bs."id" = sb."seat_id"
      WHERE sb."user_id" = bpo."user_id"
        AND bs."business_user_id" = bpo."business_user_id"
        AND bs."is_active" = true
        AND bpo."seat_id" IS NULL;
  END IF;
END $$;


-- ─── BusinessAuditLog: add actor_seat_id ────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'BusinessAuditLog'
      AND column_name  = 'actor_seat_id'
  ) THEN
    ALTER TABLE "public"."BusinessAuditLog"
      ADD COLUMN "actor_seat_id" uuid REFERENCES "public"."BusinessSeat"("id") ON DELETE SET NULL;

    -- Index for seat-based audit filtering
    CREATE INDEX IF NOT EXISTS idx_bal_actor_seat
      ON "public"."BusinessAuditLog" ("business_user_id", "actor_seat_id")
      WHERE "actor_seat_id" IS NOT NULL;

    -- Backfill actor_seat_id from metadata where available
    UPDATE "public"."BusinessAuditLog"
      SET "actor_seat_id" = ("metadata" ->> 'actor_seat_id')::uuid
      WHERE "metadata" ? 'actor_seat_id'
        AND "actor_seat_id" IS NULL
        AND ("metadata" ->> 'actor_seat_id') IS NOT NULL;
  END IF;
END $$;
