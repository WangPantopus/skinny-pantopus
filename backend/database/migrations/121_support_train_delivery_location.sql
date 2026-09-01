-- Migration 121: Add delivery location columns to SupportTrain
-- so custom addresses are stored directly instead of creating
-- phantom Home records.

ALTER TABLE "SupportTrain"
  ADD COLUMN IF NOT EXISTS "delivery_address" varchar(500),
  ADD COLUMN IF NOT EXISTS "delivery_city" varchar(100),
  ADD COLUMN IF NOT EXISTS "delivery_state" varchar(50),
  ADD COLUMN IF NOT EXISTS "delivery_zip" varchar(20),
  ADD COLUMN IF NOT EXISTS "delivery_lat" double precision,
  ADD COLUMN IF NOT EXISTS "delivery_lng" double precision,
  ADD COLUMN IF NOT EXISTS "delivery_place_id" text;

-- Backfill existing Support Trains that were linked to delivery-pin Home records.
-- Copy the address data from Home to SupportTrain, then unlink.
UPDATE "SupportTrain" st
SET
  delivery_address = h.address,
  delivery_city = h.city,
  delivery_state = h.state,
  delivery_zip = h.zipcode,
  delivery_lat = h.map_center_lat,
  delivery_lng = h.map_center_lng
FROM "Home" h
WHERE st.recipient_home_id = h.id
  AND h.niche_data->>'support_train_delivery_pin' = 'true';

-- Clear the FK so these phantom homes can be cleaned up.
UPDATE "SupportTrain" st
SET recipient_home_id = NULL
FROM "Home" h
WHERE st.recipient_home_id = h.id
  AND h.niche_data->>'support_train_delivery_pin' = 'true';

-- Also clear Activity.home_id for the same phantom homes.
UPDATE "Activity" a
SET home_id = NULL
FROM "Home" h
WHERE a.home_id = h.id
  AND h.niche_data->>'support_train_delivery_pin' = 'true';

-- Delete the phantom Home records (delivery pins only).
DELETE FROM "Home"
WHERE niche_data->>'support_train_delivery_pin' = 'true';
