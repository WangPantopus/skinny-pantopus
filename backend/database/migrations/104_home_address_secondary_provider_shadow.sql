ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS secondary_required boolean,
  ADD COLUMN IF NOT EXISTS unit_count_estimate integer,
  ADD COLUMN IF NOT EXISTS unit_intelligence_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS last_secondary_validated_at timestamptz;
