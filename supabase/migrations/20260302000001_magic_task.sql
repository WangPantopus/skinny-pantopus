-- ============================================================================
-- Migration: Magic Task — schema additions for AI-powered task creation
-- ============================================================================
-- Adds new columns to Gig for magic task features:
--   schedule_type, pay_type, language_preference, access_notes,
--   required_tools, special_instructions, preferred_helper_id,
--   source_flow, ai_confidence, ai_draft_json
--
-- Creates SavedTaskTemplate table for user quick-task templates.
-- Adds gig_status 'pending_undo' for the 10-second undo window.
-- ============================================================================

-- ============================================================================
-- 1. New ENUM types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "public"."schedule_type" AS ENUM (
    'asap',
    'today',
    'scheduled',
    'flexible'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."pay_type" AS ENUM (
    'fixed',
    'hourly',
    'offers'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."task_source_flow" AS ENUM (
    'magic',
    'classic',
    'template',
    'context_shortcut'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Add columns to Gig table
-- ============================================================================

-- Schedule type (replaces reliance on just deadline/scheduled_start)
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "schedule_type" "public"."schedule_type"
    DEFAULT 'asap'::"public"."schedule_type";

-- Pay type (fixed/hourly/offers — enriches existing price field)
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "pay_type" "public"."pay_type"
    DEFAULT 'fixed'::"public"."pay_type";

-- Time window for scheduled tasks
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "time_window_start" timestamp with time zone;

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "time_window_end" timestamp with time zone;

-- Power fields
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "language_preference" "text";

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "access_notes" "text";

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "required_tools" "text"[];

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "special_instructions" "text";

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "preferred_helper_id" "uuid"
    REFERENCES "public"."User"("id") ON DELETE SET NULL;

-- Source tracking for analytics
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "source_flow" "public"."task_source_flow";

-- AI metadata (stored for analytics, not exposed to helpers)
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "ai_confidence" numeric(3,2);

ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "ai_draft_json" "jsonb";

-- Undo support: track whether a gig is in the undo window
ALTER TABLE "public"."Gig"
  ADD COLUMN IF NOT EXISTS "undo_expires_at" timestamp with time zone;

-- User preference for instant posting
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "magic_task_instant_post" boolean DEFAULT false;

-- Track how many successful magic task posts a user has done
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "magic_task_post_count" integer DEFAULT 0;

-- ============================================================================
-- 3. SavedTaskTemplate — user-saved quick task templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."SavedTaskTemplate" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"     "uuid" NOT NULL,
    "home_id"     "uuid",
    "label"       "text" NOT NULL,
    "template"    "jsonb" NOT NULL DEFAULT '{}',
    "use_count"   integer DEFAULT 0 NOT NULL,
    "last_used"   timestamp with time zone,
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SavedTaskTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SavedTaskTemplate_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "SavedTaskTemplate_home_id_fkey" FOREIGN KEY ("home_id")
        REFERENCES "public"."Home"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."SavedTaskTemplate" OWNER TO "postgres";

-- ============================================================================
-- 4. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS "idx_gig_schedule_type"
  ON "public"."Gig" USING btree ("schedule_type");

CREATE INDEX IF NOT EXISTS "idx_gig_pay_type"
  ON "public"."Gig" USING btree ("pay_type");

CREATE INDEX IF NOT EXISTS "idx_gig_source_flow"
  ON "public"."Gig" USING btree ("source_flow")
  WHERE ("source_flow" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "idx_gig_undo_expires"
  ON "public"."Gig" USING btree ("undo_expires_at")
  WHERE ("undo_expires_at" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "idx_saved_template_user"
  ON "public"."SavedTaskTemplate" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_saved_template_home"
  ON "public"."SavedTaskTemplate" USING btree ("home_id")
  WHERE ("home_id" IS NOT NULL);

-- ============================================================================
-- 5. RLS for SavedTaskTemplate
-- ============================================================================

ALTER TABLE "public"."SavedTaskTemplate" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savedtasktemplate_select_own"
  ON "public"."SavedTaskTemplate"
  FOR SELECT TO authenticated
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "savedtasktemplate_insert_own"
  ON "public"."SavedTaskTemplate"
  FOR INSERT TO authenticated
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "savedtasktemplate_update_own"
  ON "public"."SavedTaskTemplate"
  FOR UPDATE TO authenticated
  USING ("user_id" = "auth"."uid"())
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "savedtasktemplate_delete_own"
  ON "public"."SavedTaskTemplate"
  FOR DELETE TO authenticated
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "savedtasktemplate_service"
  ON "public"."SavedTaskTemplate"
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. Grants
-- ============================================================================

GRANT ALL ON TABLE "public"."SavedTaskTemplate" TO "anon";
GRANT ALL ON TABLE "public"."SavedTaskTemplate" TO "authenticated";
GRANT ALL ON TABLE "public"."SavedTaskTemplate" TO "service_role";
