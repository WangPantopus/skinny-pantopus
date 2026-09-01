-- ============================================================================
-- Migration: User Task Affinity — tracks per-user category affinity scores
-- based on browsing, bidding, completion, and dismissal behavior.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."user_task_affinity" (
  "user_id"            uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "category"           text NOT NULL,
  "view_count"         integer NOT NULL DEFAULT 0,
  "bid_count"          integer NOT NULL DEFAULT 0,
  "completion_count"   integer NOT NULL DEFAULT 0,
  "dismiss_count"      integer NOT NULL DEFAULT 0,
  "affinity_score"     double precision NOT NULL DEFAULT 0,
  "last_interaction_at" timestamptz,
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  "updated_at"         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "category")
);

-- Index for fast lookup of all affinities for a user
CREATE INDEX IF NOT EXISTS idx_user_task_affinity_user_id
  ON "public"."user_task_affinity" ("user_id");

-- Index for fetching top affinities sorted by score
CREATE INDEX IF NOT EXISTS idx_user_task_affinity_score
  ON "public"."user_task_affinity" ("user_id", "affinity_score" DESC);
