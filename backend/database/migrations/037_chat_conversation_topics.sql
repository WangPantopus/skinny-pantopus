-- Migration 037: Chat Conversation Topics
-- Adds a ConversationTopic table for the unified person-based chat model.
-- Topics allow grouping messages by context (gig, listing, etc.) within a single
-- person-to-person conversation, eliminating duplicate chat rows.

-- 1. Create ConversationTopic table
CREATE TABLE IF NOT EXISTS "public"."ConversationTopic" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "conversation_user_id_1" uuid NOT NULL,
    "conversation_user_id_2" uuid NOT NULL,
    "topic_type" character varying(50) NOT NULL DEFAULT 'general',
    "topic_ref_id" uuid,
    "title" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'active',
    "created_by" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "last_activity_at" timestamp with time zone DEFAULT now(),
    "metadata" jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT "ConversationTopic_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConversationTopic_type_check" CHECK (
        "topic_type"::text = ANY (ARRAY[
            'general'::text, 'task'::text, 'listing'::text,
            'delivery'::text, 'home'::text, 'business'::text
        ])
    ),
    CONSTRAINT "ConversationTopic_status_check" CHECK (
        "status"::text = ANY (ARRAY[
            'active'::text, 'completed'::text, 'archived'::text
        ])
    ),
    CONSTRAINT "ConversationTopic_user_order" CHECK (
        "conversation_user_id_1" < "conversation_user_id_2"
    ),
    CONSTRAINT "ConversationTopic_unique_ref" UNIQUE (
        "conversation_user_id_1", "conversation_user_id_2", "topic_type", "topic_ref_id"
    )
);

ALTER TABLE "public"."ConversationTopic" OWNER TO "postgres";

-- Foreign keys
ALTER TABLE "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_user1_fkey"
    FOREIGN KEY ("conversation_user_id_1") REFERENCES "public"."User"("id") ON DELETE CASCADE;

ALTER TABLE "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_user2_fkey"
    FOREIGN KEY ("conversation_user_id_2") REFERENCES "public"."User"("id") ON DELETE CASCADE;

ALTER TABLE "public"."ConversationTopic"
    ADD CONSTRAINT "ConversationTopic_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_conversation_topic_users
    ON "public"."ConversationTopic" ("conversation_user_id_1", "conversation_user_id_2");
CREATE INDEX idx_conversation_topic_ref
    ON "public"."ConversationTopic" ("topic_type", "topic_ref_id") WHERE "topic_ref_id" IS NOT NULL;
CREATE INDEX idx_conversation_topic_activity
    ON "public"."ConversationTopic" ("last_activity_at" DESC);

-- 2. Add topic_id column to ChatMessage
ALTER TABLE "public"."ChatMessage"
    ADD COLUMN IF NOT EXISTS "topic_id" uuid;

ALTER TABLE "public"."ChatMessage"
    ADD CONSTRAINT "ChatMessage_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "public"."ConversationTopic"("id") ON DELETE SET NULL;

CREATE INDEX idx_chat_message_topic
    ON "public"."ChatMessage" ("topic_id") WHERE "topic_id" IS NOT NULL;

-- Composite index for topic-filtered message queries
CREATE INDEX idx_chat_message_room_topic_created
    ON "public"."ChatMessage" ("room_id", "topic_id", "created_at" DESC);

-- 3. RLS policies
ALTER TABLE "public"."ConversationTopic" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation topics"
ON "public"."ConversationTopic" FOR SELECT
USING (
    auth.uid() = "conversation_user_id_1" OR auth.uid() = "conversation_user_id_2"
);

CREATE POLICY "Users can insert their own conversation topics"
ON "public"."ConversationTopic" FOR INSERT
WITH CHECK (
    auth.uid() = "conversation_user_id_1" OR auth.uid() = "conversation_user_id_2"
);

CREATE POLICY "Users can update their own conversation topics"
ON "public"."ConversationTopic" FOR UPDATE
USING (
    auth.uid() = "conversation_user_id_1" OR auth.uid() = "conversation_user_id_2"
);

-- 4. Backfill: Create topics for existing gig-type ChatRooms
-- For each gig room, creates a 'task' topic linking the owner and the other participant
INSERT INTO "public"."ConversationTopic" (
    "conversation_user_id_1", "conversation_user_id_2",
    "topic_type", "topic_ref_id", "title", "status", "created_at", "last_activity_at"
)
SELECT DISTINCT ON (LEAST(cp_owner.user_id, cp_other.user_id), GREATEST(cp_owner.user_id, cp_other.user_id), r.gig_id)
    LEAST(cp_owner.user_id, cp_other.user_id),
    GREATEST(cp_owner.user_id, cp_other.user_id),
    'task',
    r.gig_id,
    COALESCE(r.name, 'Gig Chat'),
    'active',
    r.created_at,
    COALESCE(r.updated_at, r.created_at)
FROM "public"."ChatRoom" r
JOIN "public"."ChatParticipant" cp_owner ON cp_owner.room_id = r.id AND cp_owner.role = 'owner'
JOIN "public"."ChatParticipant" cp_other ON cp_other.room_id = r.id AND cp_other.user_id != cp_owner.user_id AND cp_other.is_active = true
WHERE r.type = 'gig' AND r.gig_id IS NOT NULL
ON CONFLICT ("conversation_user_id_1", "conversation_user_id_2", "topic_type", "topic_ref_id") DO NOTHING;

-- 5. Backfill: Tag existing gig room messages with their topic_id
UPDATE "public"."ChatMessage" cm
SET "topic_id" = ct.id
FROM "public"."ChatRoom" r,
     "public"."ChatParticipant" cp_owner,
     "public"."ChatParticipant" cp_other,
     "public"."ConversationTopic" ct
WHERE cm.room_id = r.id
  AND r.type = 'gig'
  AND r.gig_id IS NOT NULL
  AND cp_owner.room_id = r.id AND cp_owner.role = 'owner'
  AND cp_other.room_id = r.id AND cp_other.user_id != cp_owner.user_id AND cp_other.is_active = true
  AND ct.conversation_user_id_1 = LEAST(cp_owner.user_id, cp_other.user_id)
  AND ct.conversation_user_id_2 = GREATEST(cp_owner.user_id, cp_other.user_id)
  AND ct.topic_type = 'task'
  AND ct.topic_ref_id = r.gig_id
  AND cm.topic_id IS NULL;

-- 6. Backfill: Create topics for existing listing_offer messages in direct rooms
INSERT INTO "public"."ConversationTopic" (
    "conversation_user_id_1", "conversation_user_id_2",
    "topic_type", "topic_ref_id", "title", "status", "created_at", "last_activity_at"
)
SELECT DISTINCT ON (
    LEAST(cm.user_id, cp_other.user_id),
    GREATEST(cm.user_id, cp_other.user_id),
    (cm.metadata->>'listingId')::uuid
)
    LEAST(cm.user_id, cp_other.user_id),
    GREATEST(cm.user_id, cp_other.user_id),
    'listing',
    (cm.metadata->>'listingId')::uuid,
    COALESCE(cm.metadata->>'title', cm.message, 'Listing'),
    'active',
    cm.created_at,
    cm.created_at
FROM "public"."ChatMessage" cm
JOIN "public"."ChatRoom" r ON r.id = cm.room_id AND r.type = 'direct'
JOIN "public"."ChatParticipant" cp_other ON cp_other.room_id = r.id AND cp_other.user_id != cm.user_id AND cp_other.is_active = true
WHERE cm.type = 'listing_offer'
  AND cm.metadata->>'listingId' IS NOT NULL
  AND (cm.metadata->>'listingId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT ("conversation_user_id_1", "conversation_user_id_2", "topic_type", "topic_ref_id") DO NOTHING;

-- 7. Backfill: Tag existing listing_offer messages with their topic_id
UPDATE "public"."ChatMessage" cm
SET "topic_id" = ct.id
FROM "public"."ChatRoom" r,
     "public"."ChatParticipant" cp_other,
     "public"."ConversationTopic" ct
WHERE cm.room_id = r.id
  AND r.type = 'direct'
  AND cm.type = 'listing_offer'
  AND cm.metadata->>'listingId' IS NOT NULL
  AND cp_other.room_id = r.id AND cp_other.user_id != cm.user_id AND cp_other.is_active = true
  AND ct.conversation_user_id_1 = LEAST(cm.user_id, cp_other.user_id)
  AND ct.conversation_user_id_2 = GREATEST(cm.user_id, cp_other.user_id)
  AND ct.topic_type = 'listing'
  AND ct.topic_ref_id = (cm.metadata->>'listingId')::uuid
  AND cm.topic_id IS NULL;
