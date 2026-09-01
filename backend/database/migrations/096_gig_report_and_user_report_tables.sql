-- ============================================================
-- 096: Create GigReport and UserReport tables
-- Required for Apple App Store Guideline 1.2 compliance
-- ============================================================

-- GigReport table (modeled after PostReport)
CREATE TABLE IF NOT EXISTS "public"."GigReport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gig_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reason" character varying(100) NOT NULL,
    "details" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "GigReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GigReport_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['spam'::character varying, 'harassment'::character varying, 'inappropriate'::character varying, 'misinformation'::character varying, 'safety'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "GigReport_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'reviewed'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::"text"[])))
);

ALTER TABLE "public"."GigReport" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_gig_report_gig_id" ON "public"."GigReport" USING btree ("gig_id");
CREATE INDEX IF NOT EXISTS "idx_gig_report_reported_by" ON "public"."GigReport" USING btree ("reported_by");
CREATE INDEX IF NOT EXISTS "idx_gig_report_status" ON "public"."GigReport" USING btree ("status");

DO $$ BEGIN
  ALTER TABLE "public"."GigReport"
      ADD CONSTRAINT "GigReport_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "public"."Gig"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."GigReport"
      ADD CONSTRAINT "GigReport_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- UserReport table (for reporting abusive users)
CREATE TABLE IF NOT EXISTS "public"."UserReport" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reported_user_id" "uuid" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reason" character varying(100) NOT NULL,
    "details" "text",
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserReport_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['spam'::character varying, 'harassment'::character varying, 'inappropriate'::character varying, 'misinformation'::character varying, 'safety'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "UserReport_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'reviewed'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::"text"[])))
);

ALTER TABLE "public"."UserReport" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_user_report_reported_user" ON "public"."UserReport" USING btree ("reported_user_id");
CREATE INDEX IF NOT EXISTS "idx_user_report_reported_by" ON "public"."UserReport" USING btree ("reported_by");
CREATE INDEX IF NOT EXISTS "idx_user_report_status" ON "public"."UserReport" USING btree ("status");

DO $$ BEGIN
  ALTER TABLE "public"."UserReport"
      ADD CONSTRAINT "UserReport_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."UserReport"
      ADD CONSTRAINT "UserReport_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'safety' reason to existing PostReport table CHECK constraint
ALTER TABLE "public"."PostReport" DROP CONSTRAINT IF EXISTS "PostReport_reason_check";
ALTER TABLE "public"."PostReport"
    ADD CONSTRAINT "PostReport_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['spam'::character varying, 'harassment'::character varying, 'inappropriate'::character varying, 'misinformation'::character varying, 'safety'::character varying, 'other'::character varying])::"text"[])));
