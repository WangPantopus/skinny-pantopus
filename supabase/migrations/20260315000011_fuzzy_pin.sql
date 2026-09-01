-- Add display_location and show_exact_location to BusinessLocation for privacy-preserving map pins
ALTER TABLE "public"."BusinessLocation"
  ADD COLUMN IF NOT EXISTS "display_location" geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS "show_exact_location" boolean DEFAULT false;
