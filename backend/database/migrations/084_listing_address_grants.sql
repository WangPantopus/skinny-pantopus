-- Migration 084: Create listing_address_grants table for progressive location disclosure.
-- When a listing author explicitly reveals their address to a specific buyer,
-- a row is inserted here. The serializer checks this table to decide whether
-- to return exact or blurred coordinates.

CREATE TABLE IF NOT EXISTS "public"."ListingAddressGrant" (
    "id"                uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "listing_id"        uuid NOT NULL REFERENCES "public"."Listing"("id") ON DELETE CASCADE,
    "grantee_user_id"   uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "granted_by"        uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "granted_at"        timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "listing_address_grant_unique" UNIQUE ("listing_id", "grantee_user_id")
);

ALTER TABLE "public"."ListingAddressGrant" OWNER TO "postgres";

-- Index for fast lookup: "which listings has this user been granted access to?"
CREATE INDEX IF NOT EXISTS "idx_listing_address_grant_grantee"
    ON "public"."ListingAddressGrant" ("grantee_user_id");

-- Index for fast lookup: "who has access to this listing's address?"
CREATE INDEX IF NOT EXISTS "idx_listing_address_grant_listing"
    ON "public"."ListingAddressGrant" ("listing_id");

-- RLS: only the listing owner can manage grants; grantees can read their own grants
ALTER TABLE "public"."ListingAddressGrant" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."ListingAddressGrant" FROM "anon";
REVOKE ALL ON TABLE "public"."ListingAddressGrant" FROM "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."ListingAddressGrant" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingAddressGrant" TO "service_role";

CREATE POLICY "Listing owner can read grants"
    ON "public"."ListingAddressGrant"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "public"."Listing"
            WHERE "id" = "listing_id" AND "user_id" = auth.uid()
        )
    );

CREATE POLICY "Grantee can read own grants"
    ON "public"."ListingAddressGrant"
    FOR SELECT
    USING ("grantee_user_id" = auth.uid());

CREATE POLICY "Listing owner can insert grants"
    ON "public"."ListingAddressGrant"
    FOR INSERT
    WITH CHECK (
        "granted_by" = auth.uid()
        AND EXISTS (
            SELECT 1 FROM "public"."Listing"
            WHERE "id" = "listing_id" AND "user_id" = auth.uid()
        )
    );

CREATE POLICY "Listing owner can delete grants"
    ON "public"."ListingAddressGrant"
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM "public"."Listing"
            WHERE "id" = "listing_id" AND "user_id" = auth.uid()
        )
    );

COMMENT ON TABLE "public"."ListingAddressGrant"
    IS 'Tracks which buyers have been granted access to a listing''s exact address by the listing author.';
