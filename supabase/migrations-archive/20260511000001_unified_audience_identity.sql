-- Unified audience identity.
--
-- A user now has one audience-side identity for all Beacon memberships. The
-- membership row keeps fan_* snapshot columns for existing API contracts, but
-- the canonical owner is AudienceIdentity.

CREATE TABLE IF NOT EXISTS "public"."AudienceIdentity" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "public_persona_id" uuid,
  "handle" text NOT NULL,
  "handle_normalized" text NOT NULL,
  "display_name" text,
  "avatar_url" text,
  "status" text DEFAULT 'active' NOT NULL,
  "source" text DEFAULT 'generated' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "AudienceIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AudienceIdentity_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "AudienceIdentity_handle_normalized_key" UNIQUE ("handle_normalized"),
  CONSTRAINT "AudienceIdentity_public_persona_id_key" UNIQUE ("public_persona_id"),
  CONSTRAINT "AudienceIdentity_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE,
  CONSTRAINT "AudienceIdentity_public_persona_id_fkey"
    FOREIGN KEY ("public_persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE SET NULL,
  CONSTRAINT "AudienceIdentity_status_check" CHECK ("status" IN ('active', 'disabled')),
  CONSTRAINT "AudienceIdentity_source_check" CHECK ("source" IN (
    'generated', 'user_selected', 'persona_bound', 'legacy_backfill'
  )),
  CONSTRAINT "AudienceIdentity_handle_format" CHECK (
    char_length("handle") BETWEEN 3 AND 64
    AND "handle_normalized" = lower("handle")
  )
);

CREATE INDEX IF NOT EXISTS "idx_audience_identity_user_status"
  ON "public"."AudienceIdentity" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_audience_identity_persona"
  ON "public"."AudienceIdentity" ("public_persona_id");

ALTER TABLE "public"."PersonaMembership"
  ADD COLUMN IF NOT EXISTS "audience_identity_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PersonaMembership_audience_identity_id_fkey'
  ) THEN
    ALTER TABLE "public"."PersonaMembership"
      ADD CONSTRAINT "PersonaMembership_audience_identity_id_fkey"
      FOREIGN KEY ("audience_identity_id") REFERENCES "public"."AudienceIdentity"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_persona_membership_audience_identity"
  ON "public"."PersonaMembership" ("audience_identity_id");

-- Backfill one identity per user who either owns an active Beacon or already
-- follows/subscribes to one. Beacon owners inherit their Beacon handle. Everyone
-- else gets a deterministic private handle that is not derived from username.
WITH identity_users AS (
  SELECT "user_id" FROM "public"."PersonaMembership"
  UNION
  SELECT "user_id" FROM "public"."PublicPersona" WHERE "status" = 'active'
),
active_personas AS (
  SELECT DISTINCT ON ("user_id")
    "id", "user_id", "handle", "handle_normalized", "display_name", "avatar_url"
  FROM "public"."PublicPersona"
  WHERE "status" = 'active'
  ORDER BY "user_id", "updated_at" DESC, "created_at" DESC
),
proposed_identities AS (
  SELECT
    iu."user_id",
    ap."id" AS "public_persona_id",
    ap."display_name",
    ap."avatar_url",
    CASE
      WHEN ap."id" IS NOT NULL THEN ap."handle"
      ELSE 'fan_' || replace(iu."user_id"::text, '-', '')
    END AS "primary_handle",
    CASE WHEN ap."id" IS NOT NULL THEN 'persona_bound' ELSE 'legacy_backfill' END AS "source"
  FROM identity_users iu
  LEFT JOIN active_personas ap ON ap."user_id" = iu."user_id"
),
chosen_identities AS (
  SELECT
    p.*,
    chosen."handle"
  FROM proposed_identities p
  CROSS JOIN LATERAL (
    SELECT candidate."handle"
    FROM (VALUES
      (p."primary_handle", 1),
      ('fan_' || substring(md5(p."user_id"::text || ':audience_identity') from 1 for 24), 2),
      ('fan_' || substring(md5(p."user_id"::text || ':audience_identity_fallback') from 1 for 24), 3)
    ) AS candidate("handle", "priority")
    WHERE p."public_persona_id" IS NOT NULL
      OR NOT EXISTS (
        SELECT 1
        FROM "public"."PublicPersona" pp
        WHERE pp."handle_normalized" = lower(candidate."handle")
          AND pp."user_id" <> p."user_id"
      )
    ORDER BY candidate."priority"
    LIMIT 1
  ) chosen
)
INSERT INTO "public"."AudienceIdentity" (
  "user_id",
  "public_persona_id",
  "handle",
  "handle_normalized",
  "display_name",
  "avatar_url",
  "source"
)
SELECT
  ci."user_id",
  ci."public_persona_id",
  ci."handle",
  lower(ci."handle"),
  COALESCE(ci."display_name", ci."handle"),
  ci."avatar_url",
  ci."source"
FROM chosen_identities ci
ON CONFLICT ("user_id") DO NOTHING;

UPDATE "public"."PersonaMembership" pm
SET "audience_identity_id" = ai."id"
FROM "public"."AudienceIdentity" ai
WHERE pm."user_id" = ai."user_id"
  AND pm."audience_identity_id" IS NULL;

-- Collapse old per-Beacon fan aliases into the unified identity snapshot.
UPDATE "public"."PersonaMembership" pm
SET
  "fan_handle" = ai."handle",
  "fan_handle_normalized" = ai."handle_normalized",
  "fan_display_name" = ai."display_name",
  "fan_avatar_url" = ai."avatar_url",
  "updated_at" = now()
FROM "public"."AudienceIdentity" ai
WHERE pm."audience_identity_id" = ai."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "user_id" FROM "public"."PersonaMembership"
      UNION
      SELECT "user_id" FROM "public"."PublicPersona" WHERE "status" = 'active'
    ) expected
    LEFT JOIN "public"."AudienceIdentity" ai ON ai."user_id" = expected."user_id"
    WHERE ai."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'AudienceIdentity backfill did not create an identity for every expected user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."AudienceIdentity" ai
    JOIN "public"."PublicPersona" pp
      ON pp."handle_normalized" = ai."handle_normalized"
     AND pp."user_id" <> ai."user_id"
  ) THEN
    RAISE EXCEPTION 'AudienceIdentity backfill produced a cross-user Beacon handle collision';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION "public"."audience_identity_validate"()
RETURNS trigger AS $$
BEGIN
  IF NEW."public_persona_id" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "public"."PublicPersona" pp
      WHERE pp."id" = NEW."public_persona_id"
        AND pp."user_id" = NEW."user_id"
    ) THEN
      RAISE EXCEPTION 'AudienceIdentity public_persona_id must belong to the same user';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."PublicPersona" pp
    WHERE pp."handle_normalized" = NEW."handle_normalized"
      AND pp."user_id" <> NEW."user_id"
  ) THEN
    RAISE EXCEPTION 'Audience identity handle conflicts with a Beacon handle';
  END IF;

  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AudienceIdentity_validate" ON "public"."AudienceIdentity";
CREATE TRIGGER "AudienceIdentity_validate"
  BEFORE INSERT OR UPDATE ON "public"."AudienceIdentity"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."audience_identity_validate"();

CREATE OR REPLACE FUNCTION "public"."public_persona_audience_handle_validate"()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."AudienceIdentity" ai
    WHERE ai."handle_normalized" = NEW."handle_normalized"
      AND ai."user_id" <> NEW."user_id"
  ) THEN
    RAISE EXCEPTION 'Beacon handle conflicts with an audience identity handle';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "PublicPersona_audience_handle_validate" ON "public"."PublicPersona";
CREATE TRIGGER "PublicPersona_audience_handle_validate"
  BEFORE INSERT OR UPDATE ON "public"."PublicPersona"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."public_persona_audience_handle_validate"();

ALTER TABLE "public"."AudienceIdentity" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AudienceIdentity_owner_read" ON "public"."AudienceIdentity";
CREATE POLICY "AudienceIdentity_owner_read"
  ON "public"."AudienceIdentity"
  FOR SELECT
  USING (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id");

DROP POLICY IF EXISTS "AudienceIdentity_owner_update" ON "public"."AudienceIdentity";
CREATE POLICY "AudienceIdentity_owner_update"
  ON "public"."AudienceIdentity"
  FOR UPDATE
  USING (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id")
  WITH CHECK (NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid = "user_id");

GRANT ALL ON TABLE "public"."AudienceIdentity" TO "service_role";
