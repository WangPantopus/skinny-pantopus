-- ============================================================
-- Home Profile V2: Phase 0 — Schema Migrations
-- Adds: HomePet, HomePoll, HomePollVote, HomeGuestPassView
-- Alters: Home, HomeGuestPass, HomeTask, HomeScopedGrant
-- ============================================================

-- ============================================================
-- 1. NEW TABLE: HomePet
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."HomePet" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "breed" "text",
    "age_years" numeric(4,1),
    "weight_lbs" numeric(6,1),
    "vet_name" "text",
    "vet_phone" "text",
    "vet_address" "text",
    "vaccine_notes" "text",
    "feeding_schedule" "text",
    "medications" "text",
    "microchip_id" "text",
    "photo_url" "text",
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomePet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomePet_species_chk" CHECK (
        "species" = ANY (ARRAY[
            'dog'::"text", 'cat'::"text", 'bird'::"text", 'fish'::"text",
            'reptile'::"text", 'rabbit'::"text", 'hamster'::"text", 'other'::"text"
        ])
    )
);

ALTER TABLE "public"."HomePet" OWNER TO "postgres";

-- ============================================================
-- 2. NEW TABLE: HomePoll
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."HomePoll" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "home_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "poll_type" "text" DEFAULT 'single_choice'::"text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "closes_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility" "public"."home_record_visibility" DEFAULT 'members'::"public"."home_record_visibility" NOT NULL,
    CONSTRAINT "HomePoll_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomePoll_poll_type_chk" CHECK (
        "poll_type" = ANY (ARRAY[
            'single_choice'::"text", 'multiple_choice'::"text",
            'yes_no'::"text", 'ranking'::"text"
        ])
    ),
    CONSTRAINT "HomePoll_status_chk" CHECK (
        "status" = ANY (ARRAY[
            'open'::"text", 'closed'::"text", 'canceled'::"text"
        ])
    )
);

ALTER TABLE "public"."HomePoll" OWNER TO "postgres";

-- ============================================================
-- 3. NEW TABLE: HomePollVote
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."HomePollVote" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poll_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "selected_options" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "HomePollVote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomePollVote_one_vote_per_user" UNIQUE ("poll_id", "user_id")
);

ALTER TABLE "public"."HomePollVote" OWNER TO "postgres";

-- ============================================================
-- 4. NEW TABLE: HomeGuestPassView
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."HomeGuestPassView" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_pass_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "viewer_ip" "text",
    "user_agent" "text",
    CONSTRAINT "HomeGuestPassView_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."HomeGuestPassView" OWNER TO "postgres";

-- ============================================================
-- 5. ALTER TABLE: HomeGuestPass
--    (token_hash already exists; add new guest-pass columns)
--    Also add missing PRIMARY KEY on "id" so HomeGuestPassView FK works
-- ============================================================
ALTER TABLE "public"."HomeGuestPass"
    ADD CONSTRAINT "HomeGuestPass_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."HomeGuestPass"
    ADD COLUMN IF NOT EXISTS "passcode_hash" "text",
    ADD COLUMN IF NOT EXISTS "included_sections" "jsonb" DEFAULT '[]'::"jsonb",
    ADD COLUMN IF NOT EXISTS "custom_title" "text",
    ADD COLUMN IF NOT EXISTS "max_views" integer,
    ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0;

-- ============================================================
-- 6. ALTER TABLE: Home
-- ============================================================
ALTER TABLE "public"."Home"
    ADD COLUMN IF NOT EXISTS "trash_day" "text",
    ADD COLUMN IF NOT EXISTS "house_rules" "text",
    ADD COLUMN IF NOT EXISTS "local_tips" "text",
    ADD COLUMN IF NOT EXISTS "guest_welcome_message" "text",
    ADD COLUMN IF NOT EXISTS "lockdown_enabled" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "lockdown_enabled_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "lockdown_enabled_by" "uuid",
    ADD COLUMN IF NOT EXISTS "default_visibility" "public"."home_record_visibility"
        DEFAULT 'members'::"public"."home_record_visibility",
    ADD COLUMN IF NOT EXISTS "default_guest_pass_hours" integer DEFAULT 48;

-- ============================================================
-- 7. ALTER TABLE: HomeTask
--    (recurrence_rule already exists as text; add boolean helper)
-- ============================================================
ALTER TABLE "public"."HomeTask"
    ADD COLUMN IF NOT EXISTS "is_recurring" boolean DEFAULT false;

-- ============================================================
-- 8. ALTER TABLE: HomeScopedGrant
-- ============================================================
ALTER TABLE "public"."HomeScopedGrant"
    ADD COLUMN IF NOT EXISTS "token_hash" "text",
    ADD COLUMN IF NOT EXISTS "passcode_hash" "text",
    ADD COLUMN IF NOT EXISTS "max_views" integer,
    ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0;

-- ============================================================
-- 9. FOREIGN KEY CONSTRAINTS
-- ============================================================

-- HomePet → Home
ALTER TABLE "public"."HomePet"
    ADD CONSTRAINT "HomePet_home_id_fkey"
    FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;

-- HomePoll → Home
ALTER TABLE "public"."HomePoll"
    ADD CONSTRAINT "HomePoll_home_id_fkey"
    FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;

-- HomePollVote → HomePoll
ALTER TABLE "public"."HomePollVote"
    ADD CONSTRAINT "HomePollVote_poll_id_fkey"
    FOREIGN KEY ("poll_id") REFERENCES "public"."HomePoll"("id") ON DELETE CASCADE;

-- HomeGuestPassView → HomeGuestPass
ALTER TABLE "public"."HomeGuestPassView"
    ADD CONSTRAINT "HomeGuestPassView_guest_pass_id_fkey"
    FOREIGN KEY ("guest_pass_id") REFERENCES "public"."HomeGuestPass"("id") ON DELETE CASCADE;

-- ============================================================
-- 10. INDEXES
-- ============================================================

-- HomePet
CREATE INDEX IF NOT EXISTS "idx_home_pet_home"
    ON "public"."HomePet" USING "btree" ("home_id");

-- HomePoll
CREATE INDEX IF NOT EXISTS "idx_home_poll_home"
    ON "public"."HomePoll" USING "btree" ("home_id");

-- HomePollVote
CREATE INDEX IF NOT EXISTS "idx_home_poll_vote_poll"
    ON "public"."HomePollVote" USING "btree" ("poll_id");

-- HomeGuestPassView
CREATE INDEX IF NOT EXISTS "idx_home_guest_pass_view_pass"
    ON "public"."HomeGuestPassView" USING "btree" ("guest_pass_id");

-- HomeGuestPass: token index already exists (idx_home_guest_pass_hash)
-- HomeScopedGrant: new token_hash index
CREATE INDEX IF NOT EXISTS "idx_home_scoped_grant_token"
    ON "public"."HomeScopedGrant" USING "btree" ("token_hash");
