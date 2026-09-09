-- Payment.home_id is optional context; allow Home deletion without orphan FK errors.
ALTER TABLE ONLY "public"."Payment"
  DROP CONSTRAINT IF EXISTS "payment_home_id_fkey";

ALTER TABLE ONLY "public"."Payment"
  ADD CONSTRAINT "payment_home_id_fkey"
  FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE SET NULL;
