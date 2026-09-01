-- Pending "ask owner to add me" requests (backed by notifications + UI on Members > Requests)

CREATE TABLE IF NOT EXISTS "public"."HomeHouseholdAccessRequest" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "home_id" "uuid" NOT NULL,
  "requester_user_id" "uuid" NOT NULL,
  "requested_identity" "text" NOT NULL,
  "status" "text" DEFAULT 'pending'::"text" NOT NULL,
  "resolved_by" "uuid",
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "HomeHouseholdAccessRequest_identity_chk" CHECK (("requested_identity" = ANY (ARRAY['owner'::"text", 'resident'::"text", 'household_member'::"text", 'guest'::"text"]))),
  CONSTRAINT "HomeHouseholdAccessRequest_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);

ALTER TABLE ONLY "public"."HomeHouseholdAccessRequest"
  ADD CONSTRAINT "HomeHouseholdAccessRequest_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."HomeHouseholdAccessRequest"
  ADD CONSTRAINT "HomeHouseholdAccessRequest_home_id_fkey" FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."HomeHouseholdAccessRequest"
  ADD CONSTRAINT "HomeHouseholdAccessRequest_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."HomeHouseholdAccessRequest"
  ADD CONSTRAINT "HomeHouseholdAccessRequest_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."User"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "idx_household_access_one_pending_per_user"
  ON "public"."HomeHouseholdAccessRequest" ("home_id", "requester_user_id")
  WHERE ("status" = 'pending'::"text");

CREATE INDEX "idx_household_access_home_status" ON "public"."HomeHouseholdAccessRequest" ("home_id", "status");
