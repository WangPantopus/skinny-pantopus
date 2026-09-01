-- Add viewer_home_id to BusinessProfileView for geographic insights
ALTER TABLE "public"."BusinessProfileView"
  ADD COLUMN IF NOT EXISTS "viewer_home_id" uuid;

ALTER TABLE "public"."BusinessProfileView"
  ADD CONSTRAINT "BusinessProfileView_viewer_home_id_fkey"
  FOREIGN KEY ("viewer_home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;
