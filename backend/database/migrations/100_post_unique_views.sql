-- ============================================================
-- 100: Deduplicate authenticated post views
-- Adds PostView tracking plus an RPC that records one view per
-- authenticated user without resetting historical view_count.
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."PostView" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "post_id" "uuid" NOT NULL,
  "user_id" "uuid" NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."PostView" OWNER TO "postgres";

ALTER TABLE ONLY "public"."PostView"
  ADD CONSTRAINT "PostView_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."PostView"
  ADD CONSTRAINT "PostView_post_id_user_id_key" UNIQUE ("post_id", "user_id");

ALTER TABLE ONLY "public"."PostView"
  ADD CONSTRAINT "PostView_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."PostView"
  ADD CONSTRAINT "PostView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION "public"."record_post_unique_view"("p_post_id" "uuid", "p_user_id" "uuid") RETURNS boolean
  LANGUAGE "plpgsql" SECURITY DEFINER
  SET "search_path" TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row_count integer := 0;
BEGIN
  IF p_post_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO "PostView" ("post_id", "user_id")
  VALUES (p_post_id, p_user_id)
  ON CONFLICT ("post_id", "user_id") DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count > 0 THEN
    UPDATE "Post"
    SET "view_count" = COALESCE("view_count", 0) + 1
    WHERE "id" = p_post_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

ALTER FUNCTION "public"."record_post_unique_view"("p_post_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

GRANT ALL ON TABLE "public"."PostView" TO "service_role";

GRANT ALL ON FUNCTION "public"."record_post_unique_view"("p_post_id" "uuid", "p_user_id" "uuid") TO "service_role";
