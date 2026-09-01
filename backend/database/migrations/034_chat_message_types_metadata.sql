-- ============================================================
-- Chat messages: support structured metadata + richer message types
-- ============================================================

BEGIN;

ALTER TABLE "public"."ChatMessage"
  ADD COLUMN IF NOT EXISTS "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL;

ALTER TABLE "public"."ChatMessage"
  DROP CONSTRAINT IF EXISTS "ChatMessage_type_check";

ALTER TABLE "public"."ChatMessage"
  ADD CONSTRAINT "ChatMessage_type_check" CHECK (
    (("type")::"text" = ANY (
      (ARRAY[
        'text'::character varying,
        'image'::character varying,
        'video'::character varying,
        'file'::character varying,
        'audio'::character varying,
        'location'::character varying,
        'system'::character varying,
        'gig_offer'::character varying
      ])::"text"[]
    ))
  );

COMMIT;
