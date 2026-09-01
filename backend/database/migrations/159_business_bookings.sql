-- 159_business_bookings.sql
-- Real incoming-booking pipeline for businesses.
--
-- Until now the catalog "Request booking" button (POST
-- /api/businesses/:businessId/catalog/:itemId/request) tried to write a Gig
-- row with columns that do not exist on Gig (worker_id, requester_id,
-- source, catalog_item_id, pay_type) and a status the Gig CHECK forbids
-- ('pending_acceptance'), so every booking request 500'd — incoming bookings
-- were never stored anywhere.
--
-- This table is the durable home for a customer's booking request against a
-- business's catalog item:
--   * `business_user_id` is the business (provider) being booked;
--   * `requester_id` is the customer who made the request;
--   * `catalog_item_id` is the booked item (nullable — SET NULL if the item
--     is later deleted), with `item_name` / `price_cents` FROZEN at request
--     time so the booking reads correctly even after the catalog changes;
--   * `status` walks pending → accepted / declined / cancelled / completed.
--
-- Drives the "this week" stat on My businesses (count of rows created in the
-- trailing 7 days) and the GET /:businessId/bookings owner read path.

CREATE TABLE IF NOT EXISTS "public"."BusinessBooking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    -- The business (provider) being booked.
    "business_user_id" "uuid" NOT NULL,
    -- The customer who requested the booking.
    "requester_id" "uuid" NOT NULL,
    -- The catalog item booked (nullable; SET NULL if the item is removed).
    "catalog_item_id" "uuid",
    -- Frozen at request time so the booking is self-describing.
    "item_name" "text",
    "price_cents" integer,
    -- Optional free-text note from the customer.
    "note" "text",
    -- pending | accepted | declined | cancelled | completed
    "status" "text" DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BusinessBooking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessBooking_status_check"
      CHECK ("status" IN ('pending', 'accepted', 'declined', 'cancelled', 'completed'))
);

-- Owner read path + the "bookings this week" count both filter by business
-- and order/range on created_at.
CREATE INDEX IF NOT EXISTS "BusinessBooking_business_created_idx"
  ON "public"."BusinessBooking" ("business_user_id", "created_at" DESC);

-- "My booking requests" read path (customer side).
CREATE INDEX IF NOT EXISTS "BusinessBooking_requester_created_idx"
  ON "public"."BusinessBooking" ("requester_id", "created_at" DESC);

-- FKs: a booking dies with either party; the catalog link goes null if the
-- item is deleted (the frozen item_name still describes it).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessBooking_business_user_id_fkey'
  ) THEN
    ALTER TABLE "public"."BusinessBooking"
      ADD CONSTRAINT "BusinessBooking_business_user_id_fkey"
      FOREIGN KEY ("business_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessBooking_requester_id_fkey'
  ) THEN
    ALTER TABLE "public"."BusinessBooking"
      ADD CONSTRAINT "BusinessBooking_requester_id_fkey"
      FOREIGN KEY ("requester_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessBooking_catalog_item_id_fkey'
  ) THEN
    ALTER TABLE "public"."BusinessBooking"
      ADD CONSTRAINT "BusinessBooking_catalog_item_id_fkey"
      FOREIGN KEY ("catalog_item_id") REFERENCES "public"."BusinessCatalogItem"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Keep updated_at fresh on the (forthcoming) status-transition UPDATE path,
-- matching the repo convention for mutable updated_at columns.
DROP TRIGGER IF EXISTS "trg_businessbooking_updated" ON "public"."BusinessBooking";
CREATE TRIGGER "trg_businessbooking_updated"
  BEFORE UPDATE ON "public"."BusinessBooking"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();
