-- Migration 086: Create PushToken table for Expo push notification tokens.
-- Each device token is globally unique — registering it for a new user
-- automatically reassigns ownership, preventing cross-account push leaks.

CREATE TABLE IF NOT EXISTS "public"."PushToken" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PushToken_token_unique" UNIQUE ("token")
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS "idx_push_token_user_id" ON "public"."PushToken" ("user_id");

-- RLS: only service_role should manage tokens (backend-only)
ALTER TABLE "public"."PushToken" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."PushToken" FROM "anon";
REVOKE ALL ON TABLE "public"."PushToken" FROM "authenticated";
GRANT ALL ON TABLE "public"."PushToken" TO "service_role";
