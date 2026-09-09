-- ============================================================================
-- Migration: AI Agent Layer v1 — tables for AI conversations, request logging,
-- and external feed caching
-- ============================================================================

-- ============================================================================
-- 1. AIConversation — stores multi-turn AI agent conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."AIConversation" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "title"           text NOT NULL DEFAULT 'New conversation',
  "response_id"     text,           -- OpenAI Responses API previous_response_id for multi-turn
  "message_count"   int NOT NULL DEFAULT 0,
  "last_message_at" timestamptz,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

-- Index for listing a user's conversations ordered by recency
CREATE INDEX IF NOT EXISTS idx_ai_conversation_user_updated
  ON "public"."AIConversation" ("user_id", "updated_at" DESC);

-- ============================================================================
-- 2. AIRequestLog — audit + cost visibility for every AI call
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."AIRequestLog" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "conversation_id"  uuid REFERENCES "public"."AIConversation"("id") ON DELETE SET NULL,
  "endpoint"         text NOT NULL,         -- e.g. 'chat', 'draft/listing', 'place-brief'
  "model"            text NOT NULL,         -- e.g. 'gpt-4o', 'gpt-4o-mini'
  "prompt_version"   text NOT NULL DEFAULT 'v1.0',
  "status"           text NOT NULL DEFAULT 'ok',   -- ok, schema_error, tool_error, timeout, rate_limited
  "latency_ms"       int,
  "input_tokens"     int,
  "output_tokens"    int,
  "tool_calls_count" int DEFAULT 0,
  "schema_valid"     boolean DEFAULT true,
  "cache_hit"        boolean DEFAULT false,
  "error_message"    text,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);

-- Index for analytics queries by user, endpoint, status
CREATE INDEX IF NOT EXISTS idx_ai_request_log_user
  ON "public"."AIRequestLog" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_log_endpoint
  ON "public"."AIRequestLog" ("endpoint", "created_at" DESC);

-- ============================================================================
-- 3. ExternalFeedCache — caches external data (NOAA, WSDOT, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."ExternalFeedCache" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider"    text NOT NULL,         -- NOAA_ALERTS, WSDOT_INCIDENTS, ODOT_INCIDENTS, etc.
  "place_key"   text NOT NULL,         -- placeId or 'lat,lng,radius'
  "fetched_at"  timestamptz NOT NULL DEFAULT now(),
  "expires_at"  timestamptz NOT NULL,
  "etag"        text,                  -- HTTP ETag for conditional requests
  "payload"     jsonb NOT NULL,        -- { raw, normalized }
  CONSTRAINT uq_external_feed_cache_provider_place UNIQUE ("provider", "place_key")
);

-- Index for cache lookups: find valid (non-expired) entries by provider + place
CREATE INDEX IF NOT EXISTS idx_external_feed_cache_lookup
  ON "public"."ExternalFeedCache" ("provider", "place_key", "expires_at" DESC);

-- ============================================================================
-- 4. RLS policies
-- ============================================================================

-- AIConversation: users can only access their own conversations
ALTER TABLE "public"."AIConversation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI conversations"
  ON "public"."AIConversation" FOR SELECT
  USING (auth.uid() = "user_id");

CREATE POLICY "Users can insert own AI conversations"
  ON "public"."AIConversation" FOR INSERT
  WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "Users can update own AI conversations"
  ON "public"."AIConversation" FOR UPDATE
  USING (auth.uid() = "user_id");

CREATE POLICY "Users can delete own AI conversations"
  ON "public"."AIConversation" FOR DELETE
  USING (auth.uid() = "user_id");

-- AIRequestLog: users can view their own logs (admin can view all via service role)
ALTER TABLE "public"."AIRequestLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI request logs"
  ON "public"."AIRequestLog" FOR SELECT
  USING (auth.uid() = "user_id");

-- ExternalFeedCache: service role only (no user-facing RLS needed)
ALTER TABLE "public"."ExternalFeedCache" ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (handled at application layer via supabaseAdmin)
