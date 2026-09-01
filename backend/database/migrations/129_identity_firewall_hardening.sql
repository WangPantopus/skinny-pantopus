-- Identity Firewall hardening delta.
--
-- This migration is intentionally additive because 128_identity_firewall_personas.sql
-- may already be applied in existing environments. Keep this file idempotent so it
-- can safely repair databases that ran an earlier draft of the Identity Firewall
-- migration.

ALTER TABLE "public"."PersonaFollow"
  DROP CONSTRAINT IF EXISTS "PersonaFollow_source_check";

ALTER TABLE "public"."PersonaFollow"
  ADD CONSTRAINT "PersonaFollow_source_check"
  CHECK ("source" IN ('self_follow', 'follow_request', 'request_approved', 'invite', 'import', 'organization_managed'));

CREATE TABLE IF NOT EXISTS "public"."IdentityAuditLog" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid,
  "target_user_id" uuid,
  "persona_id" uuid,
  "action" text NOT NULL,
  "target_type" text,
  "target_id" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "IdentityAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdentityAuditLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL,
  CONSTRAINT "IdentityAuditLog_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."User"("id") ON DELETE SET NULL,
  CONSTRAINT "IdentityAuditLog_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."PublicPersona"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_identity_audit_actor_created"
  ON "public"."IdentityAuditLog" ("actor_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_identity_audit_persona_created"
  ON "public"."IdentityAuditLog" ("persona_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_identity_audit_action_created"
  ON "public"."IdentityAuditLog" ("action", "created_at" DESC);

ALTER TABLE "public"."IdentityAuditLog" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."IdentityAuditLog" TO "service_role";
