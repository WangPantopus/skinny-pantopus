CREATE TABLE IF NOT EXISTS "AddressVerificationEvent" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "address_id" uuid REFERENCES "HomeAddress"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "provider" text,
  "status" text NOT NULL,
  "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "raw_response" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_addr_verif_event_address_created_at
  ON "AddressVerificationEvent" ("address_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS idx_addr_verif_event_type_created_at
  ON "AddressVerificationEvent" ("event_type", "created_at" DESC);

CREATE INDEX IF NOT EXISTS idx_addr_verif_event_provider_created_at
  ON "AddressVerificationEvent" ("provider", "created_at" DESC)
  WHERE "provider" IS NOT NULL;

ALTER TABLE "AddressVerificationEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addr_verif_event_service"
  ON "AddressVerificationEvent"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

GRANT ALL ON TABLE "AddressVerificationEvent" TO "service_role";
