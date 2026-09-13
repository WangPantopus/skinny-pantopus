-- Current ordinary household members can read permitted household Tasks,
-- create their own Tasks, edit their own readable Tasks and complete Tasks
-- assigned to them under the existing record gateway. No tasks.manage grant.
-- This deliberately also changes live defaults for existing member occupancies;
-- their recorded roles, age bands, admission history and overrides stay intact.
-- Preserve existing operator role decisions, including explicit false values.
-- The existing age ceilings, current access, manager/sensitive visibility and
-- source-Mail recipient checks continue to constrain every read and mutation.
--
-- Non-null invitation policy snapshots remain immutable and reject changed
-- current policy. Legacy null snapshots retain the existing compatibility path.
-- Completed decision receipts remain historical; no stored terms are rewritten.
-- Backwards compatible: yes. Existing Task clients consume the same permissions,
-- routes and response shapes; this additive policy change introduces no schema.
SET LOCAL lock_timeout = '5s';

INSERT INTO public."HomeRolePermission" (role_base, permission, allowed)
VALUES ('member', 'tasks.view', true),
       ('member', 'tasks.edit', true)
ON CONFLICT (role_base, permission) DO NOTHING;
