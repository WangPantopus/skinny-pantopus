-- NeighborhoodSignalCache: ephemeral neighborhood signals (new business, events, alerts)
CREATE TABLE IF NOT EXISTS "public"."NeighborhoodSignalCache" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "signal_type" text NOT NULL,
  "priority" integer DEFAULT 5 NOT NULL,
  "title" text NOT NULL,
  "detail" text,
  "data" jsonb DEFAULT '{}' NOT NULL,
  "place_key" varchar(255),
  "privacy_level" text DEFAULT 'public',
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "NeighborhoodSignalCache_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."NeighborhoodSignalCache" OWNER TO "postgres";

CREATE INDEX "idx_nsc_place_type" ON "public"."NeighborhoodSignalCache" ("place_key", "signal_type");
CREATE INDEX "idx_nsc_expires" ON "public"."NeighborhoodSignalCache" ("expires_at") WHERE "expires_at" IS NOT NULL;
