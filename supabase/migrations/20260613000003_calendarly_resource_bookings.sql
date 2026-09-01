-- 162_calendarly_resource_bookings.sql
-- Calendarly — enable resource-only bookings (a booked room/vehicle/tool has no event type) and
-- guard resource double-booking atomically, reusing the same buffer-padded guard range + btree_gist.
-- Depends on 160 (Booking + guard trigger + btree_gist).

-- A resource booking carries resource_id but no event_type_id.
ALTER TABLE "public"."Booking" ALTER COLUMN "event_type_id" DROP NOT NULL;

-- Every booking must reference at least an event type or a resource.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_event_or_resource_chk') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_event_or_resource_chk"
      CHECK ("event_type_id" IS NOT NULL OR "resource_id" IS NOT NULL);
  END IF;
END $$;

-- Atomic no-overlap guard for a single resource's active bookings (buffer-padded via guard_*).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_resource_no_overlap') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_resource_no_overlap"
      EXCLUDE USING gist (
        "resource_id" WITH =,
        "tstzrange"("guard_start", "guard_end") WITH &&
      )
      WHERE (
        "status" = ANY (ARRAY['pending'::"public"."booking_status", 'confirmed'::"public"."booking_status"])
        AND "resource_id" IS NOT NULL
        AND "guard_start" IS NOT NULL
        AND "guard_end" IS NOT NULL
      );
  END IF;
END $$;
