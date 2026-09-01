-- Migration 103: HomeAddress provider place types shadow column
--
-- Add a first-class column for provider-backed place types while preserving the
-- existing heuristic google_place_types column that live decisioning depends on.

ALTER TABLE "HomeAddress"
  ADD COLUMN IF NOT EXISTS "provider_place_types" text[] DEFAULT ARRAY[]::text[];
