-- Pantopus Identity Firewall: local profiles, audience personas, persona audience graph, and broadcast.

ALTER TYPE "public"."post_as_type" ADD VALUE IF NOT EXISTS 'persona';
ALTER TYPE "public"."post_audience" ADD VALUE IF NOT EXISTS 'public';

CREATE TABLE IF NOT EXISTS "public"."LocalProfile" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "handle" text NOT NULL,
  "handle_normalized" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "bio" text,
  "tagline" text,
  "public_city" text,
  "public_state" text,
  "public_neighborhood" text,
  "show_verified_resident_badge" boolean DEFAULT true NOT NULL,
  "show_home_affiliation" boolean DEFAULT false NOT NULL,
  "show_neighborhood" boolean DEFAULT false NOT NULL,
  "show_gig_history" boolean DEFAULT true NOT NULL,
  "profile_visibility" text DEFAULT 'public' NOT NULL,
  "search_visibility" text DEFAULT 'everyone' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "LocalProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocalProfile_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "LocalProfile_handle_key" UNIQUE ("handle"),
  CONSTRAINT "LocalProfile_handle_normalized_key" UNIQUE ("handle_normalized"),
  CONSTRAINT "LocalProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "LocalProfile_profile_visibility_check" CHECK ("profile_visibility" IN ('public', 'followers', 'connections', 'private')),
  CONSTRAINT "LocalProfile_search_visibility_check" CHECK ("search_visibility" IN ('everyone', 'mutuals', 'nobody'))
);

CREATE TABLE IF NOT EXISTS "public"."PublicPersona" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "handle" text NOT NULL,
  "handle_normalized" text NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "banner_url" text,
  "bio" text,
  "public_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "category" text DEFAULT 'creator' NOT NULL,
  "audience_label" text DEFAULT 'followers' NOT NULL,
  "audience_mode" text DEFAULT 'open' NOT NULL,
  "professional_category" text,
  "credential_status" text DEFAULT 'none' NOT NULL,
  "organization_name" text,
  "organization_affiliation_status" text DEFAULT 'none' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "follower_count" integer DEFAULT 0 NOT NULL,
  "post_count" integer DEFAULT 0 NOT NULL,
  "broadcast_enabled" boolean DEFAULT true NOT NULL,
  "is_searchable" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "PublicPersona_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicPersona_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "PublicPersona_handle_key" UNIQUE ("handle"),
  CONSTRAINT "PublicPersona_handle_normalized_key" UNIQUE ("handle_normalized"),
  CONSTRAINT "PublicPersona_audience_mode_check" CHECK ("audience_mode" IN ('open', 'approval_required', 'invite_only', 'organization_managed')),
  CONSTRAINT "PublicPersona_credential_status_check" CHECK ("credential_status" IN ('none', 'pending', 'verified', 'rejected', 'expired')),
  CONSTRAINT "PublicPersona_org_affiliation_status_check" CHECK ("organization_affiliation_status" IN ('none', 'pending', 'verified', 'rejected')),
  CONSTRAINT "PublicPersona_status_check" CHECK ("status" IN ('draft', 'active', 'paused', 'suspended'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicPersona_one_active_per_user"
  ON "public"."PublicPersona" ("user_id")
  WHERE "status" = 'active';

CREATE TABLE IF NOT EXISTS "public"."PersonaFollow" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "follower_user_id" uuid NOT NULL,
  "relationship_type" text DEFAULT 'follower' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "source" text DEFAULT 'self_follow' NOT NULL,
  "notification_level" text DEFAULT 'all' NOT NULL,
  "public_visibility" text DEFAULT 'private' NOT NULL,
  "approved_by_user_id" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "PersonaFollow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PersonaFollow_persona_follower_key" UNIQUE ("persona_id", "follower_user_id"),
  CONSTRAINT "PersonaFollow_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaFollow_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "PersonaFollow_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL,
  CONSTRAINT "PersonaFollow_relationship_type_check" CHECK ("relationship_type" IN ('follower', 'patient', 'student', 'client', 'customer', 'subscriber', 'member')),
  CONSTRAINT "PersonaFollow_status_check" CHECK ("status" IN ('pending', 'active', 'muted', 'blocked', 'removed')),
  CONSTRAINT "PersonaFollow_source_check" CHECK ("source" IN ('self_follow', 'follow_request', 'request_approved', 'invite', 'import', 'organization_managed')),
  CONSTRAINT "PersonaFollow_notification_level_check" CHECK ("notification_level" IN ('all', 'highlights', 'none')),
  CONSTRAINT "PersonaFollow_public_visibility_check" CHECK ("public_visibility" IN ('private', 'visible_to_owner', 'public'))
);

CREATE INDEX IF NOT EXISTS "idx_persona_follow_follower" ON "public"."PersonaFollow" ("follower_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_persona_follow_persona" ON "public"."PersonaFollow" ("persona_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "public"."IdentityBridgeSetting" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "persona_id" uuid NOT NULL,
  "show_persona_on_local" boolean DEFAULT false NOT NULL,
  "show_local_on_persona" boolean DEFAULT false NOT NULL,
  "bridge_label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "IdentityBridgeSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdentityBridgeSetting_user_persona_key" UNIQUE ("user_id", "persona_id"),
  CONSTRAINT "IdentityBridgeSetting_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "IdentityBridgeSetting_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."BroadcastChannel" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "persona_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "BroadcastChannel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BroadcastChannel_persona_id_key" UNIQUE ("persona_id"),
  CONSTRAINT "BroadcastChannel_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE,
  CONSTRAINT "BroadcastChannel_status_check" CHECK ("status" IN ('active', 'paused', 'archived'))
);

CREATE TABLE IF NOT EXISTS "public"."BroadcastMessage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL,
  "persona_id" uuid NOT NULL,
  "author_user_id" uuid NOT NULL,
  "body" text,
  "media" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "visibility" text DEFAULT 'followers' NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "published_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BroadcastMessage_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."BroadcastChannel"("id") ON DELETE CASCADE,
  CONSTRAINT "BroadcastMessage_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE CASCADE,
  CONSTRAINT "BroadcastMessage_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "BroadcastMessage_visibility_check" CHECK ("visibility" IN ('public', 'followers', 'subscribers')),
  CONSTRAINT "BroadcastMessage_status_check" CHECK ("status" IN ('draft', 'published', 'archived', 'removed'))
);

CREATE TABLE IF NOT EXISTS "public"."IdentityAuditLog" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid,
  "target_user_id" uuid,
  "persona_id" uuid,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "IdentityAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdentityAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL,
  CONSTRAINT "IdentityAuditLog_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL,
  CONSTRAINT "IdentityAuditLog_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_broadcast_message_channel_published"
  ON "public"."BroadcastMessage" ("channel_id", "published_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_identity_audit_actor_created"
  ON "public"."IdentityAuditLog" ("actor_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_identity_audit_persona_created"
  ON "public"."IdentityAuditLog" ("persona_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_identity_audit_action_created"
  ON "public"."IdentityAuditLog" ("action", "created_at" DESC);

ALTER TABLE "public"."IdentityAuditLog" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."IdentityAuditLog" TO "service_role";

ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "author_user_id" uuid,
  ADD COLUMN IF NOT EXISTS "identity_context_type" text,
  ADD COLUMN IF NOT EXISTS "identity_context_id" uuid;

ALTER TABLE "public"."UserFollow"
  ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'legacy' NOT NULL;

WITH users_to_backfill AS (
  SELECT
    u.*,
    ups."show_neighborhood" AS "privacy_show_neighborhood",
    COALESCE(NULLIF(u."username", ''), 'user-' || replace(u."id"::text, '-', '')) AS "base_handle"
  FROM "public"."User" u
  LEFT JOIN "public"."UserPrivacySettings" ups ON ups."user_id" = u."id"
  WHERE NOT EXISTS (
    SELECT 1 FROM "public"."LocalProfile" lp WHERE lp."user_id" = u."id"
  )
),
ranked_users AS (
  SELECT
    users_to_backfill.*,
    lower("base_handle") AS "base_handle_normalized",
    count(*) OVER (PARTITION BY lower("base_handle")) AS "handle_group_count"
  FROM users_to_backfill
),
resolved_users AS (
  SELECT
    ranked_users.*,
    CASE
      WHEN "handle_group_count" = 1
        AND NOT EXISTS (
          SELECT 1
          FROM "public"."LocalProfile" existing_lp
          WHERE existing_lp."handle_normalized" = ranked_users."base_handle_normalized"
        )
        THEN "base_handle"
      ELSE "base_handle" || '-' || replace(ranked_users."id"::text, '-', '')
    END AS "resolved_handle"
  FROM ranked_users
)
INSERT INTO "public"."LocalProfile" (
  "user_id",
  "handle",
  "handle_normalized",
  "display_name",
  "avatar_url",
  "bio",
  "public_city",
  "public_state",
  "show_neighborhood",
  "created_at",
  "updated_at"
)
SELECT
  resolved_users."id",
  resolved_users."resolved_handle",
  lower(resolved_users."resolved_handle"),
  COALESCE(NULLIF(resolved_users."name", ''), NULLIF(resolved_users."first_name", ''), NULLIF(resolved_users."username", ''), 'Pantopus member'),
  resolved_users."profile_picture_url",
  resolved_users."bio",
  CASE WHEN resolved_users."privacy_show_neighborhood" = 'public' THEN resolved_users."city" ELSE NULL END,
  CASE WHEN resolved_users."privacy_show_neighborhood" = 'public' THEN resolved_users."state" ELSE NULL END,
  COALESCE(resolved_users."privacy_show_neighborhood" = 'public', false),
  now(),
  now()
FROM resolved_users
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "public"."Post" p
SET
  "author_user_id" = COALESCE(p."author_user_id", p."user_id"),
  "identity_context_type" = COALESCE(
    p."identity_context_type",
    CASE
      WHEN p."post_as" = 'home' THEN 'home'
      WHEN p."post_as" = 'business' THEN 'business'
      ELSE 'local'
    END
  ),
  "identity_context_id" = COALESCE(
    p."identity_context_id",
    CASE
      WHEN p."post_as" = 'home' THEN p."home_id"
      WHEN p."post_as" = 'business' THEN p."business_id"
      ELSE lp."id"
    END
  )
FROM "public"."LocalProfile" lp
WHERE p."user_id" = lp."user_id"
  AND (p."author_user_id" IS NULL OR p."identity_context_type" IS NULL OR p."identity_context_id" IS NULL);
