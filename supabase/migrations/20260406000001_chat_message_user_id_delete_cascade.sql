-- ChatMessage.user_id is NOT NULL but the FK used ON DELETE SET NULL, which
-- cannot succeed and blocks deleting a User row. Align with NOT NULL by
-- cascading: deleting a user removes their chat messages (and reactions via
-- existing MessageReaction FKs).

ALTER TABLE "public"."ChatMessage"
  DROP CONSTRAINT IF EXISTS "ChatMessage_user_id_fkey";

ALTER TABLE "public"."ChatMessage"
  ADD CONSTRAINT "ChatMessage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
