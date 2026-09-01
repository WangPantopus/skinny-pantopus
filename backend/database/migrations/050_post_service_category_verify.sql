-- M3: Post service_category verification
-- service_category TEXT already exists on Post. This is a safety check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Post'
      AND column_name = 'service_category'
  ) THEN
    ALTER TABLE "Post" ADD COLUMN "service_category" TEXT;
  END IF;
END $$;
