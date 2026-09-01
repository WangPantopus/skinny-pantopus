-- Migration 085: Harden ListingAddressGrant privileges and RLS after 084.
-- This repair migration ensures already-applied local databases cannot be used
-- by arbitrary authenticated clients to self-grant listing address access.

REVOKE ALL ON TABLE "public"."ListingAddressGrant" FROM "anon";
REVOKE ALL ON TABLE "public"."ListingAddressGrant" FROM "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."ListingAddressGrant" TO "authenticated";
GRANT ALL ON TABLE "public"."ListingAddressGrant" TO "service_role";

DROP POLICY IF EXISTS "Listing owner can manage grants" ON "public"."ListingAddressGrant";
DROP POLICY IF EXISTS "Listing owner can read grants" ON "public"."ListingAddressGrant";
DROP POLICY IF EXISTS "Grantee can read own grants" ON "public"."ListingAddressGrant";
DROP POLICY IF EXISTS "Listing owner can insert grants" ON "public"."ListingAddressGrant";
DROP POLICY IF EXISTS "Listing owner can delete grants" ON "public"."ListingAddressGrant";

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
