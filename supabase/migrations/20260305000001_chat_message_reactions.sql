CREATE TABLE IF NOT EXISTS "public"."MessageReaction" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MessageReaction_message_user_reaction_key" UNIQUE ("message_id", "user_id", "reaction"),
    CONSTRAINT "MessageReaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ChatMessage"("id") ON DELETE CASCADE,
    CONSTRAINT "MessageReaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_message_reaction_message" ON "public"."MessageReaction" USING btree ("message_id");
CREATE INDEX IF NOT EXISTS "idx_message_reaction_user" ON "public"."MessageReaction" USING btree ("user_id");

ALTER TABLE "public"."MessageReaction" ENABLE ROW LEVEL SECURITY;
