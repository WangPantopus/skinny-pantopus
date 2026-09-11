-- Track the actual human actor behind business identity messages.
-- NULL when the sender acts as themselves (user_id = actor_user_id).
-- Populated when a team member sends on behalf of a business identity.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "actor_user_id" UUID REFERENCES "User"(id);

-- Index for audit queries: "which messages did this team member send?"
CREATE INDEX IF NOT EXISTS idx_chatmessage_actor_user_id
  ON "ChatMessage" ("actor_user_id")
  WHERE "actor_user_id" IS NOT NULL;
