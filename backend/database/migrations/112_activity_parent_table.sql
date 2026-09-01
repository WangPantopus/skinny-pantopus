-- Migration 112: Activity parent table
--
-- Introduces the Activity parent entity that serves as a shared container
-- for Pantopus tasks / activities. Support Train is the first activity_type.

BEGIN;

CREATE TABLE "public"."Activity" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "creator_user_id" "uuid" NOT NULL,
  "activity_type" character varying(50) NOT NULL,
  "status" character varying(50) NOT NULL DEFAULT 'draft',
  "title" character varying(255),
  "summary" "text",
  "visibility" character varying(50) DEFAULT 'private',
  "cover_media_url" "text",
  "location_id" "uuid",
  "home_id" "uuid",
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "timezone" character varying(64),
  "chat_thread_id" "uuid",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "Activity_activity_type_check" CHECK (
    ("activity_type")::"text" = ANY (ARRAY['support_train'::"text"])
  ),

  CONSTRAINT "Activity_status_check" CHECK (
    ("status")::"text" = ANY (ARRAY[
      'draft'::"text",
      'published'::"text",
      'active'::"text",
      'paused'::"text",
      'completed'::"text",
      'archived'::"text"
    ])
  ),

  CONSTRAINT "Activity_creator_user_id_fkey"
    FOREIGN KEY ("creator_user_id")
    REFERENCES "public"."User"("id") ON DELETE CASCADE,

  CONSTRAINT "Activity_home_id_fkey"
    FOREIGN KEY ("home_id")
    REFERENCES "public"."Home"("id") ON DELETE SET NULL
);

-- Indexes
CREATE INDEX "idx_activity_creator_user_id"
  ON "public"."Activity" ("creator_user_id");

CREATE INDEX "idx_activity_type_status"
  ON "public"."Activity" ("activity_type", "status");

CREATE INDEX "idx_activity_home_id"
  ON "public"."Activity" ("home_id")
  WHERE "home_id" IS NOT NULL;

CREATE INDEX "idx_activity_updated_at"
  ON "public"."Activity" ("updated_at" DESC);

-- updated_at trigger using existing touch_updated_at() function
DROP TRIGGER IF EXISTS "trg_activity_updated_at" ON "public"."Activity";
CREATE TRIGGER "trg_activity_updated_at"
  BEFORE UPDATE ON "public"."Activity"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

COMMIT;
