-- Migration 118: Manual Support Train address sharing grants.
-- Organizers can explicitly reveal a train's exact address to a specific helper.

BEGIN;

ALTER TABLE "public"."SupportTrain"
  ALTER COLUMN "show_exact_address_after_signup" SET DEFAULT false;

CREATE TABLE IF NOT EXISTS "public"."SupportTrainAddressGrant" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "support_train_id" uuid NOT NULL REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE,
  "grantee_user_id" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "granted_by" uuid NOT NULL REFERENCES "public"."User"("id") ON DELETE CASCADE,
  "granted_at" timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT "support_train_address_grant_unique"
    UNIQUE ("support_train_id", "grantee_user_id")
);

CREATE INDEX IF NOT EXISTS "idx_support_train_address_grant_grantee"
  ON "public"."SupportTrainAddressGrant" ("grantee_user_id");

CREATE INDEX IF NOT EXISTS "idx_support_train_address_grant_train"
  ON "public"."SupportTrainAddressGrant" ("support_train_id");

ALTER TABLE "public"."SupportTrainAddressGrant" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."SupportTrainAddressGrant" FROM "anon";
REVOKE ALL ON TABLE "public"."SupportTrainAddressGrant" FROM "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."SupportTrainAddressGrant" TO "authenticated";
GRANT ALL ON TABLE "public"."SupportTrainAddressGrant" TO "service_role";

CREATE POLICY "Support Train organizer can read address grants"
  ON "public"."SupportTrainAddressGrant"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."SupportTrainOrganizer" o
      WHERE o."support_train_id" = "SupportTrainAddressGrant"."support_train_id"
        AND o."user_id" = auth.uid()
        AND o."role" IN ('primary', 'co_organizer')
    )
  );

CREATE POLICY "Support Train helper can read own address grants"
  ON "public"."SupportTrainAddressGrant"
  FOR SELECT
  USING ("grantee_user_id" = auth.uid());

CREATE POLICY "Support Train organizer can insert address grants"
  ON "public"."SupportTrainAddressGrant"
  FOR INSERT
  WITH CHECK (
    "granted_by" = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "public"."SupportTrainOrganizer" o
      WHERE o."support_train_id" = "SupportTrainAddressGrant"."support_train_id"
        AND o."user_id" = auth.uid()
        AND o."role" IN ('primary', 'co_organizer')
    )
  );

CREATE POLICY "Support Train organizer can delete address grants"
  ON "public"."SupportTrainAddressGrant"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM "public"."SupportTrainOrganizer" o
      WHERE o."support_train_id" = "SupportTrainAddressGrant"."support_train_id"
        AND o."user_id" = auth.uid()
        AND o."role" IN ('primary', 'co_organizer')
    )
  );

COMMENT ON TABLE "public"."SupportTrainAddressGrant"
  IS 'Tracks which helpers have been manually granted exact-address access for a Support Train.';

COMMIT;
