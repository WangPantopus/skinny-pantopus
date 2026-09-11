-- A verified, current household member can open the Home's permitted overview.
-- Address creation and pending/provisional occupancy still confer no membership.
-- Add only missing read defaults; preserve operator-set role denies and all
-- per-person overrides. Current residency, age and expiry fences stay in the
-- existing effective-access resolver.
--
-- Invitations snapshot the complete role defaults. An older affected pending
-- invitation must be reissued by an authorized inviter (INVITE_POLICY_CHANGED);
-- do not rewrite its saved policy or silently broaden its original terms.
-- Backwards compatible: yes. Existing readers use these role defaults and
-- invitation clients already handle the existing INVITE_POLICY_CHANGED result.
-- No schema or response shape changes, and no stored decisions are overwritten.
SET LOCAL lock_timeout = '5s';

INSERT INTO public."HomeRolePermission" (role_base, permission, allowed)
VALUES ('admin', 'home.view', true),
       ('manager', 'home.view', true),
       ('member', 'home.view', true),
       ('restricted_member', 'home.view', true),
       ('guest', 'home.view', true)
ON CONFLICT (role_base, permission) DO NOTHING;
