-- Restore the personal profile follower graph used by the main-branch
-- Profile page. This is idempotent so local databases that already ran the
-- removal migration can recover, while fresh databases where that migration is
-- absent keep the existing table/trigger.

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "followers_count" integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS "public"."UserFollow" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "follower_id" uuid NOT NULL,
  "following_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "UserFollow_check" CHECK ("follower_id" <> "following_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_follower_id_following_id_key"
  ON "public"."UserFollow" ("follower_id", "following_id");

CREATE INDEX IF NOT EXISTS "idx_user_follow_follower"
  ON "public"."UserFollow" ("follower_id");

CREATE INDEX IF NOT EXISTS "idx_user_follow_following"
  ON "public"."UserFollow" ("following_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserFollow_pkey'
      AND conrelid = 'public."UserFollow"'::regclass
  ) THEN
    ALTER TABLE "public"."UserFollow"
      ADD CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserFollow_follower_id_fkey'
      AND conrelid = 'public."UserFollow"'::regclass
  ) THEN
    ALTER TABLE "public"."UserFollow"
      ADD CONSTRAINT "UserFollow_follower_id_fkey"
      FOREIGN KEY ("follower_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserFollow_following_id_fkey'
      AND conrelid = 'public."UserFollow"'::regclass
  ) THEN
    ALTER TABLE "public"."UserFollow"
      ADD CONSTRAINT "UserFollow_following_id_fkey"
      FOREIGN KEY ("following_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "public"."sync_followers_count"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "User" SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "User" SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg_sync_followers_count" ON "public"."UserFollow";
CREATE TRIGGER "trg_sync_followers_count"
  AFTER INSERT OR DELETE ON "public"."UserFollow"
  FOR EACH ROW EXECUTE FUNCTION "public"."sync_followers_count"();

UPDATE "public"."User" u
SET followers_count = counts.followers
FROM (
  SELECT following_id, count(*)::integer AS followers
  FROM "public"."UserFollow"
  GROUP BY following_id
) counts
WHERE u.id = counts.following_id;

UPDATE "public"."User" u
SET followers_count = 0
WHERE followers_count IS NULL;

ALTER TABLE "public"."UserFollow" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."UserFollow" TO anon;
GRANT ALL ON TABLE "public"."UserFollow" TO authenticated;
GRANT ALL ON TABLE "public"."UserFollow" TO service_role;
GRANT ALL ON FUNCTION "public"."sync_followers_count"() TO anon;
GRANT ALL ON FUNCTION "public"."sync_followers_count"() TO authenticated;
GRANT ALL ON FUNCTION "public"."sync_followers_count"() TO service_role;
