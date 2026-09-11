-- 160_auth_devices.sql
-- Persistent login & trusted devices — registry tables (design §5,
-- docs/persistent-login/persistent-login-design-2026-08-18.md).
--
-- Supabase Auth (GoTrue) stays the only session authority. This migration adds
-- the thin Pantopus-owned layer that makes sessions listable/revocable and lets
-- /api/users/refresh require a proof-of-possession (DPoP, RFC 9449) from the
-- device key bound to that session:
--
--   AuthDevice        one row per (user, hardware key) — public key + trust state
--   AuthSession       one row per Supabase session (id = JWT session_id claim)
--   AuthResumeGrant   Android reinstall resume (Block Store): single-use, hashed
--   AuthChallenge     step-up / attestation nonces + consumed step-up jtis
--   AuthDpopJti       DPoP replay cache (10-min TTL, cron-pruned)
--   AuthSecurityEvent per-user security timeline ("Where you're logged in")
--   User.sessions_valid_after   JWT iat < this ⇒ 401 SESSION_REVOKED
--   User.security_prefs         {allowRestoreGrants, newDeviceEmail}
--   PushToken.device_id         links an APNs/FCM token to AuthDevice.device_id
--
-- All new tables are service_role only (same RLS pattern as 086_push_tokens.sql).
-- Everything here is additive; no existing column changes meaning.

-- ---------------------------------------------------------------------------
-- AuthDevice — one row per (user, hardware key). iOS keeps the row across
-- reinstall (the Secure Enclave key survives); Android gets a new row per
-- install (the Keystore key dies with uninstall) linked through
-- resumed_from_device.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AuthDevice" (
    "id"                  "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"             "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- Client UUIDv4, generated together with the key.
    "device_id"           "text" NOT NULL,
    "platform"            "text" NOT NULL,
    -- {kty:'EC',crv:'P-256',x,y}; NULL for web.
    "public_key_jwk"      "jsonb",
    -- RFC 7638 SHA-256 thumbprint of public_key_jwk.
    "key_thumbprint"      "text",
    "key_backing"         "text" DEFAULT 'none' NOT NULL,
    "attestation_level"   "text" DEFAULT 'none' NOT NULL,
    -- App Attest keyId+receipt digest / Keystore chain summary / Play verdict
    -- (stored, not verified, in v1 — attestation_level stays 'none').
    "attestation"         "jsonb",
    "trust_level"         "text" DEFAULT 'unverified' NOT NULL,
    -- Biometry-bound step-up key; enrolled_via 'interactive' | 'restored'.
    "step_key_jwk"        "jsonb",
    "step_key_enrolled_via" "text",
    -- Server-forced L2 ("Continue as" + biometric) on the next launch.
    "require_step_up"     boolean DEFAULT false NOT NULL,
    -- Per-install random; rotates on reinstall.
    "install_id"          "text",
    "name"                "text",
    "model"               "text",
    "os_version"          "text",
    "app_version"         "text",
    -- First interactive login on this key.
    "trusted_at"          timestamp with time zone,
    "last_seen_at"        timestamp with time zone,
    "last_ip"             inet,
    "last_user_agent"     "text",
    "last_resumed_at"     timestamp with time zone,
    -- Android: previous row (proves lineage after a Block Store resume).
    "resumed_from_device" "uuid" REFERENCES "public"."AuthDevice"("id") ON DELETE SET NULL,
    "revoked_at"          timestamp with time zone,
    -- user|password_change|reuse|mismatch|inactivity|account_deleted|superseded|lockdown
    "revoked_reason"      "text",
    "created_at"          timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"          timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AuthDevice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthDevice_user_device_unique" UNIQUE ("user_id", "device_id"),
    CONSTRAINT "AuthDevice_platform_check"
        CHECK ("platform" IN ('ios', 'android', 'web')),
    CONSTRAINT "AuthDevice_key_backing_check"
        CHECK ("key_backing" IN ('none', 'software', 'tee', 'strongbox', 'secure_enclave')),
    CONSTRAINT "AuthDevice_attestation_level_check"
        CHECK ("attestation_level" IN ('none', 'key_attest', 'app_attest', 'play_basic', 'play_device', 'play_strong')),
    CONSTRAINT "AuthDevice_trust_level_check"
        CHECK ("trust_level" IN ('trusted', 'unverified', 'suspect')),
    CONSTRAINT "AuthDevice_step_key_enrolled_via_check"
        CHECK ("step_key_enrolled_via" IS NULL OR "step_key_enrolled_via" IN ('interactive', 'restored'))
);

-- Lookup by key thumbprint (register / per-thumbprint limits). Deliberately
-- NOT unique on (device_id, key_thumbprint): the same physical device (same
-- key) may hold rows for several accounts — the registry is per (user, device).
CREATE INDEX IF NOT EXISTS "authdevice_key_idx"
    ON "public"."AuthDevice" ("key_thumbprint")
    WHERE "key_thumbprint" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "authdevice_user_active_idx"
    ON "public"."AuthDevice" ("user_id")
    WHERE "revoked_at" IS NULL;

ALTER TABLE "public"."AuthDevice" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AuthDevice" FROM "anon";
REVOKE ALL ON TABLE "public"."AuthDevice" FROM "authenticated";
GRANT ALL ON TABLE "public"."AuthDevice" TO "service_role";

-- ---------------------------------------------------------------------------
-- AuthSession — one row per Supabase session (JWT session_id). device_id is
-- NULL for web sessions and for legacy (pre-DPoP) mobile sessions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AuthSession" (
    -- = JWT session_id claim
    "id"                       "uuid" NOT NULL,
    "user_id"                  "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "device_id"                "uuid" REFERENCES "public"."AuthDevice"("id") ON DELETE SET NULL,
    "context"                  "text" DEFAULT 'interactive' NOT NULL,
    -- password|oauth_google|oauth_apple|siwa_native|google_native|passkey|resume_grant
    "auth_method"              "text",
    "bound_at_issue"           boolean DEFAULT false NOT NULL,
    -- sha256(refreshToken) base64url; prev_ tolerates a crash between GoTrue
    -- rotation and our persist step.
    "refresh_token_hash"       "text",
    "prev_refresh_token_hash"  "text",
    "issued_at"                timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_refresh_at"          timestamp with time zone,
    "last_seen_at"             timestamp with time zone,
    "last_ip"                  inet,
    "user_agent"               "text",
    "revoked_at"               timestamp with time zone,
    -- logout|user|password_change|password_reset|reuse|mismatch|inactivity|
    -- device_revoked|superseded|lockdown|account_deleted
    "revoked_reason"           "text",
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthSession_context_check"
        CHECK ("context" IN ('interactive', 'restored', 'oauth'))
);

CREATE INDEX IF NOT EXISTS "authsession_user_idx"
    ON "public"."AuthSession" ("user_id")
    WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "authsession_rth_idx"
    ON "public"."AuthSession" ("refresh_token_hash");
CREATE INDEX IF NOT EXISTS "authsession_prev_rth_idx"
    ON "public"."AuthSession" ("prev_refresh_token_hash")
    WHERE "prev_refresh_token_hash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "authsession_device_idx"
    ON "public"."AuthSession" ("device_id")
    WHERE "device_id" IS NOT NULL;

ALTER TABLE "public"."AuthSession" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AuthSession" FROM "anon";
REVOKE ALL ON TABLE "public"."AuthSession" FROM "authenticated";
GRANT ALL ON TABLE "public"."AuthSession" TO "service_role";

-- ---------------------------------------------------------------------------
-- AuthResumeGrant — Android reinstall resume (Block Store). Single-use,
-- hashed, AUTH_RESUME_GRANT_DAYS (90 d), revocable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AuthResumeGrant" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"     "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    -- Issuing device.
    "device_id"   "uuid" REFERENCES "public"."AuthDevice"("id") ON DELETE SET NULL,
    -- sha256(grant) base64url; grant = 32 random bytes b64url.
    "grant_hash"  "text" NOT NULL,
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at"  timestamp with time zone NOT NULL,
    "used_at"     timestamp with time zone,
    "revoked_at"  timestamp with time zone,
    CONSTRAINT "AuthResumeGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthResumeGrant_grant_hash_unique" UNIQUE ("grant_hash")
);

CREATE INDEX IF NOT EXISTS "authresumegrant_user_idx"
    ON "public"."AuthResumeGrant" ("user_id")
    WHERE "used_at" IS NULL AND "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "authresumegrant_device_idx"
    ON "public"."AuthResumeGrant" ("device_id")
    WHERE "device_id" IS NOT NULL;

ALTER TABLE "public"."AuthResumeGrant" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AuthResumeGrant" FROM "anon";
REVOKE ALL ON TABLE "public"."AuthResumeGrant" FROM "authenticated";
GRANT ALL ON TABLE "public"."AuthResumeGrant" TO "service_role";

-- ---------------------------------------------------------------------------
-- AuthChallenge — attestation / step-up nonces (10-min TTL) and consumed
-- one-shot step-up token jtis (purpose 'stepup_used', expires with the token).
-- `challenge` holds the raw nonce (b64url) for purposes that need the server
-- to re-derive the signed bytes (step_up / attestation); NULL for jti rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AuthChallenge" (
    "id"          "text" NOT NULL,
    "purpose"     "text" NOT NULL,
    "challenge"   "text",
    "expires_at"  timestamp with time zone NOT NULL,
    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "authchallenge_expires_idx"
    ON "public"."AuthChallenge" ("expires_at");

ALTER TABLE "public"."AuthChallenge" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AuthChallenge" FROM "anon";
REVOKE ALL ON TABLE "public"."AuthChallenge" FROM "authenticated";
GRANT ALL ON TABLE "public"."AuthChallenge" TO "service_role";

-- ---------------------------------------------------------------------------
-- AuthDpopJti — DPoP replay cache (10-min TTL, cron-pruned). PK conflict on
-- insert ⇒ 401 DPOP_REPLAY.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AuthDpopJti" (
    "jti"         "text" NOT NULL,
    "expires_at"  timestamp with time zone NOT NULL,
    CONSTRAINT "AuthDpopJti_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX IF NOT EXISTS "authdpopjti_expires_idx"
    ON "public"."AuthDpopJti" ("expires_at");

ALTER TABLE "public"."AuthDpopJti" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AuthDpopJti" FROM "anon";
REVOKE ALL ON TABLE "public"."AuthDpopJti" FROM "authenticated";
GRANT ALL ON TABLE "public"."AuthDpopJti" TO "service_role";

-- ---------------------------------------------------------------------------
-- AuthSecurityEvent — per-user security timeline. Retention 180 d.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."AuthSecurityEvent" (
    "id"          bigserial NOT NULL,
    "user_id"     "uuid" NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "device_id"   "uuid" REFERENCES "public"."AuthDevice"("id") ON DELETE SET NULL,
    "session_id"  "uuid",
    -- login|oauth_login|resume|refresh_reuse|device_mismatch|device_revoked|
    -- revoke_others|revoke_all|lockdown|password_changed|password_reset|logout|
    -- inactivity_expired|account_deleted|step_up|new_device_email_sent
    "type"        "text" NOT NULL,
    "ip"          inet,
    "user_agent"  "text",
    "meta"        "jsonb",
    "created_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "authsecurityevent_user_idx"
    ON "public"."AuthSecurityEvent" ("user_id", "created_at" DESC);

ALTER TABLE "public"."AuthSecurityEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."AuthSecurityEvent" FROM "anon";
REVOKE ALL ON TABLE "public"."AuthSecurityEvent" FROM "authenticated";
GRANT ALL ON TABLE "public"."AuthSecurityEvent" TO "service_role";

-- ---------------------------------------------------------------------------
-- User — revocation watermark + security preferences.
--   sessions_valid_after: JWTs whose iat is older are refused (401 SESSION_REVOKED).
--   security_prefs: {allowRestoreGrants:bool, newDeviceEmail:bool} (defaults true/true
--   are applied in code so an empty object means "defaults").
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."User"
    ADD COLUMN IF NOT EXISTS "sessions_valid_after" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "security_prefs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL;

-- ---------------------------------------------------------------------------
-- PushToken — link an APNs/FCM token to the device that registered it so a
-- device revoke / logout can delete exactly that device's tokens.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."PushToken"
    ADD COLUMN IF NOT EXISTS "device_id" "text";

CREATE INDEX IF NOT EXISTS "idx_push_token_user_device"
    ON "public"."PushToken" ("user_id", "device_id")
    WHERE "device_id" IS NOT NULL;
