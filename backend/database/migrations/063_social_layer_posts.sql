-- ============================================================
-- MIGRATION 063: Social Layer — Post Purpose, Utility Score,
--                Profile Visibility, Cooldowns & Not-Helpful
--
-- Adds:
--   - purpose column (ask/offer/heads_up/recommend/learn/showcase/story/event/deal)
--   - utility_score (computed by background job every 15 min)
--   - show_on_profile + profile_visibility_scope
--   - is_visitor_post flag
--   - state lifecycle column (open/solved) for Ask posts
--   - save_count denormalized counter + sync trigger
--   - not_helpful_count + PostNotHelpful table + sync trigger
--   - UserPostingCooldown table (proportional moderation)
--   - Politics opt-in on UserFeedPreference
--   - Indexes for feed ranking, profile, and Nearby queries
--   - Backfill purpose from existing post_type values
-- ============================================================


-- ─── 1. NEW COLUMNS ON POST ─────────────────────────────────

ALTER TABLE "public"."Post"
  -- Core intent field. Maps to: ask | offer | heads_up | recommend | learn | showcase | story | event | deal
  ADD COLUMN IF NOT EXISTS "purpose" varchar(30),
  -- Computed quality signal (0.0 to 10.0), updated by recomputeUtilityScores job
  ADD COLUMN IF NOT EXISTS "utility_score" numeric(4,2) DEFAULT 0.00,
  -- Profile visibility controls (per-post, set at compose time)
  ADD COLUMN IF NOT EXISTS "show_on_profile" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "profile_visibility_scope" varchar(20) DEFAULT 'public',
  -- Auto-detected: true when poster's verified home is in a different place than target_place_id
  ADD COLUMN IF NOT EXISTS "is_visitor_post" boolean DEFAULT false,
  -- Lifecycle state for Ask/Question posts (open → solved).
  -- NOTE: This tracks *content lifecycle*, NOT *visibility lifecycle*.
  -- Archive status is still managed by is_archived / archived_at / archive_reason.
  ADD COLUMN IF NOT EXISTS "state" varchar(20) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "solved_at" timestamptz,
  -- Denormalized save count for fast ranking (synced by trigger from PostSave)
  ADD COLUMN IF NOT EXISTS "save_count" integer DEFAULT 0,
  -- Denormalized not-helpful count for ranking penalty (synced by trigger from PostNotHelpful)
  ADD COLUMN IF NOT EXISTS "not_helpful_count" integer DEFAULT 0;


-- ─── 2. CHECK CONSTRAINTS ───────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_purpose_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_purpose_check"
        CHECK (purpose IS NULL OR purpose IN (
          'ask', 'offer', 'heads_up', 'recommend', 'learn',
          'showcase', 'story', 'event', 'deal'
        ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_profile_visibility_scope_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_profile_visibility_scope_check"
        CHECK (profile_visibility_scope IN (
          'public', 'followers', 'connections', 'local_context', 'hidden'
        ));
  END IF;
END $$;

-- state tracks content lifecycle only: open → solved.
-- "archived" is handled by is_archived / archived_at columns — no overlap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_state_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_state_check"
        CHECK (state IN ('open', 'solved'));
  END IF;
END $$;


-- ─── 3. PostNotHelpful TABLE ────────────────────────────────

CREATE TABLE IF NOT EXISTS "public"."PostNotHelpful" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "surface" varchar(20) DEFAULT 'nearby',
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id"),
  UNIQUE ("post_id", "user_id"),
  FOREIGN KEY ("post_id") REFERENCES "public"."Post"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

-- Surface CHECK — constrain to known audience lenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PostNotHelpful_surface_check'
  ) THEN
    ALTER TABLE "public"."PostNotHelpful"
      ADD CONSTRAINT "PostNotHelpful_surface_check"
        CHECK (surface IN ('nearby', 'connections', 'followers'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_post_not_helpful_post"
  ON "public"."PostNotHelpful" ("post_id");

CREATE INDEX IF NOT EXISTS "idx_post_not_helpful_user"
  ON "public"."PostNotHelpful" ("user_id");


-- ─── 4. COUNTER SYNC TRIGGERS ───────────────────────────────

-- 4a. not_helpful_count trigger (PostNotHelpful → Post)
CREATE OR REPLACE FUNCTION update_post_not_helpful_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "public"."Post"
    SET not_helpful_count = not_helpful_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."Post"
    SET not_helpful_count = GREATEST(not_helpful_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_not_helpful_count ON "public"."PostNotHelpful";
CREATE TRIGGER trg_post_not_helpful_count
AFTER INSERT OR DELETE ON "public"."PostNotHelpful"
FOR EACH ROW EXECUTE FUNCTION update_post_not_helpful_count();

-- 4b. save_count trigger (PostSave → Post)
CREATE OR REPLACE FUNCTION update_post_save_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "public"."Post"
    SET save_count = save_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "public"."Post"
    SET save_count = GREATEST(save_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_save_count ON "public"."PostSave";
CREATE TRIGGER trg_post_save_count
AFTER INSERT OR DELETE ON "public"."PostSave"
FOR EACH ROW EXECUTE FUNCTION update_post_save_count();


-- ─── 5. UserPostingCooldown TABLE ───────────────────────────

CREATE TABLE IF NOT EXISTS "public"."UserPostingCooldown" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "surface" varchar(20) DEFAULT 'nearby',
  "restriction_level" varchar(20) DEFAULT 'warning',
    -- warning | template_only | reduced_radius | cooldown_1h | cooldown_24h
  "reason" text,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "created_by" varchar(20) DEFAULT 'system',
  PRIMARY KEY ("id"),
  FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserPostingCooldown_restriction_level_check'
  ) THEN
    ALTER TABLE "public"."UserPostingCooldown"
      ADD CONSTRAINT "UserPostingCooldown_restriction_level_check"
        CHECK (restriction_level IN (
          'warning', 'template_only', 'reduced_radius', 'cooldown_1h', 'cooldown_24h'
        ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_cooldown_user_surface_expires"
  ON "public"."UserPostingCooldown" ("user_id", "surface", "expires_at");


-- ─── 6. POLITICS OPT-IN ON UserFeedPreference ──────────────

ALTER TABLE "public"."UserFeedPreference"
  ADD COLUMN IF NOT EXISTS "show_politics_following" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "show_politics_connections" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "show_politics_place" boolean DEFAULT false;

-- Add updated_at trigger (missing from migration 040)
DROP TRIGGER IF EXISTS touch_updated_at ON "public"."UserFeedPreference";
CREATE TRIGGER touch_updated_at
BEFORE UPDATE ON "public"."UserFeedPreference"
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ─── 7. INDEXES ─────────────────────────────────────────────

-- Utility score for global ranking
CREATE INDEX IF NOT EXISTS "Post_utility_score_idx"
  ON "public"."Post" ("utility_score" DESC, "created_at" DESC)
  WHERE "archived_at" IS NULL;

-- Profile visibility scope for profile page queries
CREATE INDEX IF NOT EXISTS "Post_profile_visibility_idx"
  ON "public"."Post" ("user_id", "profile_visibility_scope", "created_at" DESC)
  WHERE "archived_at" IS NULL AND "show_on_profile" = true;

-- State for Ask lifecycle queries
CREATE INDEX IF NOT EXISTS "Post_state_idx"
  ON "public"."Post" ("state", "created_at" DESC)
  WHERE "archived_at" IS NULL;

-- Compound index for Nearby feed ranked by utility_score
-- Covers the main Nearby query: WHERE audience='nearby' AND target_place_id=? ORDER BY utility_score
CREATE INDEX IF NOT EXISTS "Post_nearby_place_utility_idx"
  ON "public"."Post" ("audience", "target_place_id", "utility_score" DESC, "created_at" DESC)
  WHERE "archived_at" IS NULL;


-- ─── 8. BACKFILL save_count FROM PostSave ───────────────────

UPDATE "public"."Post" p
SET save_count = sub.cnt
FROM (
  SELECT post_id, COUNT(*) AS cnt
  FROM "public"."PostSave"
  GROUP BY post_id
) sub
WHERE p.id = sub.post_id
  AND p.save_count = 0;


-- ─── 9. BACKFILL purpose FROM post_type ─────────────────────

UPDATE "public"."Post" SET purpose = CASE
  WHEN post_type IN ('question', 'ask_local')          THEN 'ask'
  WHEN post_type IN ('service_offer', 'services_offers') THEN 'offer'
  WHEN post_type IN ('safety_alert', 'alert', 'local_update', 'announcement') THEN 'heads_up'
  WHEN post_type = 'recommendation'                    THEN 'recommend'
  WHEN post_type IN ('resources_howto', 'visitor_guide') THEN 'learn'
  WHEN post_type IN ('progress_wins', 'neighborhood_win') THEN 'showcase'
  WHEN post_type IN ('general', 'personal_update', 'complaint') THEN 'story'
  WHEN post_type = 'event'                             THEN 'event'
  WHEN post_type IN ('deal', 'deals_promos')           THEN 'deal'
  WHEN post_type = 'lost_found'                        THEN 'ask'
  WHEN post_type = 'poll'                              THEN 'ask'
  ELSE NULL
END
WHERE purpose IS NULL;

-- Backfill state for already-resolved posts
UPDATE "public"."Post"
SET state = 'solved', solved_at = resolved_at
WHERE resolved_at IS NOT NULL
  AND state = 'open';


-- ─── 10. GRANTS ─────────────────────────────────────────────

GRANT ALL ON TABLE "public"."PostNotHelpful" TO "authenticated";
GRANT ALL ON TABLE "public"."PostNotHelpful" TO "service_role";
GRANT ALL ON TABLE "public"."UserPostingCooldown" TO "authenticated";
GRANT ALL ON TABLE "public"."UserPostingCooldown" TO "service_role";


-- ─── 11. ROW LEVEL SECURITY ────────────────────────────────

ALTER TABLE "public"."PostNotHelpful" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_not_helpful_select_own"
  ON "public"."PostNotHelpful" FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "post_not_helpful_insert_own"
  ON "public"."PostNotHelpful" FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "post_not_helpful_delete_own"
  ON "public"."PostNotHelpful" FOR DELETE
  USING (user_id = auth.uid());

ALTER TABLE "public"."UserPostingCooldown" ENABLE ROW LEVEL SECURITY;

-- Cooldowns are read-only for the user (system/admin creates them)
CREATE POLICY "cooldown_select_own"
  ON "public"."UserPostingCooldown" FOR SELECT
  USING (user_id = auth.uid());

-- Service role can manage all cooldowns (for background jobs / admin)
CREATE POLICY "cooldown_service_all"
  ON "public"."UserPostingCooldown" FOR ALL
  USING (auth.role() = 'service_role');
