-- Unify Beacon broadcasts into Post storage.
--
-- BroadcastMessage is kept as transitional legacy storage/read fallback, but
-- new Beacon updates are written to Post with identity_context_type='persona'.

ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "broadcast_channel_id" uuid,
  ADD COLUMN IF NOT EXISTS "target_tier_rank" integer,
  ADD COLUMN IF NOT EXISTS "delivered_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "read_count" integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Post_broadcast_channel_id_fkey'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_broadcast_channel_id_fkey"
      FOREIGN KEY ("broadcast_channel_id")
      REFERENCES "public"."BroadcastChannel"("id")
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Post_target_tier_rank_check'
  ) THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_target_tier_rank_check"
      CHECK ("target_tier_rank" IS NULL OR "target_tier_rank" BETWEEN 1 AND 4);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_post_broadcast_channel_created"
  ON "public"."Post" ("broadcast_channel_id", "created_at" DESC)
  WHERE "identity_context_type" = 'persona' AND "archived_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_post_persona_tier_feed"
  ON "public"."Post" ("identity_context_id", "target_tier_rank", "created_at" DESC)
  WHERE "identity_context_type" = 'persona' AND "archived_at" IS NULL;

WITH broadcast_rows AS (
  SELECT
    bm.*,
    (
      SELECT COALESCE(array_agg(url) FILTER (WHERE url IS NOT NULL AND url <> ''), '{}'::text[])
      FROM (
        SELECT CASE
          WHEN jsonb_typeof(item.value) = 'string'
            THEN trim(both '"' from item.value::text)
          ELSE COALESCE(
            item.value->>'url',
            item.value->>'uri',
            item.value->>'src',
            item.value->>'path'
          )
        END AS url
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(COALESCE(bm.media, '[]'::jsonb)) = 'array'
            THEN COALESCE(bm.media, '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) AS item(value)
      ) media_urls
    ) AS media_urls,
    (
      SELECT COALESCE(array_agg(media_type) FILTER (WHERE media_type IS NOT NULL AND media_type <> ''), '{}'::text[])
      FROM (
        SELECT CASE
          WHEN jsonb_typeof(item.value) = 'object'
            THEN COALESCE(item.value->>'type', item.value->>'media_type', item.value->>'mimeType')
          ELSE NULL
        END AS media_type
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(COALESCE(bm.media, '[]'::jsonb)) = 'array'
            THEN COALESCE(bm.media, '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) AS item(value)
      ) media_types
    ) AS media_types
  FROM "public"."BroadcastMessage" bm
  WHERE bm.status = 'published'
)
INSERT INTO "public"."Post" (
  "id",
  "user_id",
  "author_user_id",
  "identity_context_type",
  "identity_context_id",
  "content",
  "media_urls",
  "media_types",
  "post_type",
  "post_format",
  "visibility",
  "visibility_scope",
  "location_precision",
  "tags",
  "post_as",
  "audience",
  "distribution_targets",
  "purpose",
  "show_on_profile",
  "profile_visibility_scope",
  "state",
  "post_metadata",
  "origin",
  "broadcast_channel_id",
  "target_tier_rank",
  "delivered_count",
  "read_count",
  "created_at",
  "updated_at"
)
SELECT
  br.id,
  br.author_user_id,
  br.author_user_id,
  'persona',
  br.persona_id,
  COALESCE(br.body, ''),
  br.media_urls,
  br.media_types,
  'personal_update',
  'standard',
  CASE WHEN br.visibility = 'public' THEN 'public' ELSE 'followers' END,
  'global',
  'none',
  '{}'::text[],
  'persona',
  CASE WHEN br.visibility = 'public' THEN 'public'::"public"."post_audience" ELSE 'followers'::"public"."post_audience" END,
  CASE
    WHEN br.visibility = 'public' THEN ARRAY['public', 'persona_followers']::text[]
    ELSE ARRAY['persona_followers']::text[]
  END,
  NULL,
  true,
  CASE WHEN br.visibility = 'public' THEN 'public' ELSE 'followers' END,
  'open',
  jsonb_strip_nulls(jsonb_build_object(
    'source', 'broadcast_migration',
    'legacy_broadcast_id', br.id,
    'broadcast_visibility', br.visibility,
    'broadcast_status', br.status,
    'broadcast_media', COALESCE(br.media, '[]'::jsonb)
  )),
  'user',
  br.channel_id,
  CASE
    WHEN br.visibility IN ('tier_or_above', 'subscribers') THEN COALESCE(br.target_tier_rank, 2)
    ELSE NULL
  END,
  COALESCE(br.delivered_count, 0),
  COALESCE(br.read_count, 0),
  COALESCE(br.published_at, br.created_at, now()),
  COALESCE(br.updated_at, br.created_at, br.published_at, now())
FROM broadcast_rows br
ON CONFLICT ("id") DO UPDATE SET
  "broadcast_channel_id" = COALESCE("Post"."broadcast_channel_id", EXCLUDED."broadcast_channel_id"),
  "target_tier_rank" = COALESCE("Post"."target_tier_rank", EXCLUDED."target_tier_rank"),
  "delivered_count" = GREATEST(COALESCE("Post"."delivered_count", 0), EXCLUDED."delivered_count"),
  "read_count" = GREATEST(COALESCE("Post"."read_count", 0), EXCLUDED."read_count"),
  "post_metadata" = COALESCE("Post"."post_metadata", '{}'::jsonb) || EXCLUDED."post_metadata"
WHERE "Post"."identity_context_type" = 'persona'
  AND "Post"."identity_context_id" = EXCLUDED."identity_context_id";
