ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS parcel_provider text,
  ADD COLUMN IF NOT EXISTS parcel_id text,
  ADD COLUMN IF NOT EXISTS parcel_land_use text,
  ADD COLUMN IF NOT EXISTS parcel_property_type text,
  ADD COLUMN IF NOT EXISTS parcel_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS building_count integer,
  ADD COLUMN IF NOT EXISTS residential_unit_count integer,
  ADD COLUMN IF NOT EXISTS non_residential_unit_count integer,
  ADD COLUMN IF NOT EXISTS usage_class text,
  ADD COLUMN IF NOT EXISTS last_parcel_validated_at timestamptz;

CREATE INDEX IF NOT EXISTS "HomeAddress_parcel_id_idx"
  ON "HomeAddress" ("parcel_id");
