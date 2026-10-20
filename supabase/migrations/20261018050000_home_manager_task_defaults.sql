-- Backwards compatible: yes. A member promoted to manager keeps the same
-- basic Task permissions as a member. No task-management, document, access,
-- finance, member-management or sensitive-data permission is added.
-- Preserve explicit role denies and every per-person override. Existing
-- admission, age, expiry, visibility and source-Mail checks still apply.
-- Pending invitation policy snapshots are not rewritten: affected invitations
-- must be reissued through the existing INVITE_POLICY_CHANGED flow.
SET LOCAL lock_timeout = '5s';

INSERT INTO public."HomeRolePermission" (role_base, permission, allowed)
VALUES ('manager', 'tasks.view', true),
       ('manager', 'tasks.edit', true)
ON CONFLICT (role_base, permission) DO NOTHING;
