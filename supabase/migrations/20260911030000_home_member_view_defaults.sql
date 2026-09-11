-- A verified, current household member can open the Home's permitted overview.
-- Address creation and pending/provisional occupancy still confer no membership.
-- Add only missing read defaults; preserve operator-set role denies and all
-- per-person overrides. Current residency, age and expiry fences stay in the
-- existing effective-access resolver.
--
-- Invitations snapshot the complete role defaults. An older affected pending
-- invitation must be reissued by an authorized inviter (INVITE_POLICY_CHANGED);
-- do not rewrite its saved policy or silently broaden its original terms.
INSERT INTO public."HomeRolePermission" (role_base, permission, allowed)
VALUES ('admin', 'home.view', true),
       ('manager', 'home.view', true),
       ('member', 'home.view', true),
       ('restricted_member', 'home.view', true),
       ('guest', 'home.view', true)
ON CONFLICT (role_base, permission) DO NOTHING;
