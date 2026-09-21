-- Public persona feed mutes are distinct from private account and notification mutes.
-- Reuse PostMute and its existing owner/type/id/surface uniqueness contract.
-- Backwards compatible: yes. Existing user/business/topic rows remain unchanged.
-- Commit the enum addition before any application write uses the new value.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TYPE public.muted_entity_type ADD VALUE IF NOT EXISTS 'persona';
COMMIT;
