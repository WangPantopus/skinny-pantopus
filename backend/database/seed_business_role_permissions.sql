-- ============================================================
-- Seed: BusinessRolePermission
--
-- Default permission matrix for the 5 business roles.
-- Owner always has all perms (enforced in code), so no rows needed.
-- Run once; subsequent runs are idempotent thanks to ON CONFLICT.
-- ============================================================

-- Helper: insert if not exists
INSERT INTO "public"."BusinessRolePermission" ("role_base", "permission", "allowed")
VALUES
  -- ============================================================
  -- ADMIN — full operational control, minus ownership actions
  -- ============================================================
  ('admin', 'profile.view',      true),
  ('admin', 'profile.edit',      true),
  ('admin', 'locations.view',    true),
  ('admin', 'locations.edit',    true),
  ('admin', 'locations.manage',  true),
  ('admin', 'hours.view',        true),
  ('admin', 'hours.edit',        true),
  ('admin', 'catalog.view',      true),
  ('admin', 'catalog.edit',      true),
  ('admin', 'catalog.manage',    true),
  ('admin', 'pages.view',        true),
  ('admin', 'pages.edit',        true),
  ('admin', 'pages.publish',     true),
  ('admin', 'pages.manage',      true),
  ('admin', 'team.view',         true),
  ('admin', 'team.invite',       true),
  ('admin', 'team.manage',       true),
  ('admin', 'reviews.view',      true),
  ('admin', 'reviews.respond',   true),
  ('admin', 'gigs.post',         true),
  ('admin', 'gigs.manage',       true),
  ('admin', 'mail.view',         true),
  ('admin', 'mail.send',         true),
  ('admin', 'ads.view',          true),
  ('admin', 'ads.manage',        true),
  ('admin', 'finance.view',      true),
  ('admin', 'finance.manage',    true),
  ('admin', 'insights.view',     true),
  ('admin', 'sensitive.view',    true),

  -- ============================================================
  -- EDITOR — content management, no team/finance control
  -- ============================================================
  ('editor', 'profile.view',     true),
  ('editor', 'profile.edit',     true),
  ('editor', 'locations.view',   true),
  ('editor', 'locations.edit',   true),
  ('editor', 'locations.manage', false),
  ('editor', 'hours.view',       true),
  ('editor', 'hours.edit',       true),
  ('editor', 'catalog.view',     true),
  ('editor', 'catalog.edit',     true),
  ('editor', 'catalog.manage',   false),
  ('editor', 'pages.view',       true),
  ('editor', 'pages.edit',       true),
  ('editor', 'pages.publish',    true),
  ('editor', 'pages.manage',     false),
  ('editor', 'team.view',        true),
  ('editor', 'team.invite',      false),
  ('editor', 'team.manage',      false),
  ('editor', 'reviews.view',     true),
  ('editor', 'reviews.respond',  true),
  ('editor', 'gigs.post',        true),
  ('editor', 'gigs.manage',      false),
  ('editor', 'mail.view',        true),
  ('editor', 'mail.send',        true),
  ('editor', 'ads.view',         true),
  ('editor', 'ads.manage',       false),
  ('editor', 'finance.view',     false),
  ('editor', 'finance.manage',   false),
  ('editor', 'insights.view',    true),
  ('editor', 'sensitive.view',   false),

  -- ============================================================
  -- STAFF — day-to-day operations, limited editing
  -- ============================================================
  ('staff', 'profile.view',      true),
  ('staff', 'profile.edit',      false),
  ('staff', 'locations.view',    true),
  ('staff', 'locations.edit',    false),
  ('staff', 'locations.manage',  false),
  ('staff', 'hours.view',        true),
  ('staff', 'hours.edit',        false),
  ('staff', 'catalog.view',      true),
  ('staff', 'catalog.edit',      false),
  ('staff', 'catalog.manage',    false),
  ('staff', 'pages.view',        true),
  ('staff', 'pages.edit',        false),
  ('staff', 'pages.publish',     false),
  ('staff', 'pages.manage',      false),
  ('staff', 'team.view',         true),
  ('staff', 'team.invite',       false),
  ('staff', 'team.manage',       false),
  ('staff', 'reviews.view',      true),
  ('staff', 'reviews.respond',   false),
  ('staff', 'gigs.post',         true),
  ('staff', 'gigs.manage',       false),
  ('staff', 'mail.view',         true),
  ('staff', 'mail.send',         true),
  ('staff', 'ads.view',          false),
  ('staff', 'ads.manage',        false),
  ('staff', 'finance.view',      false),
  ('staff', 'finance.manage',    false),
  ('staff', 'insights.view',     false),
  ('staff', 'sensitive.view',    false),

  -- ============================================================
  -- VIEWER — read-only public-facing info
  -- ============================================================
  ('viewer', 'profile.view',     true),
  ('viewer', 'profile.edit',     false),
  ('viewer', 'locations.view',   true),
  ('viewer', 'locations.edit',   false),
  ('viewer', 'locations.manage', false),
  ('viewer', 'hours.view',       true),
  ('viewer', 'hours.edit',       false),
  ('viewer', 'catalog.view',     true),
  ('viewer', 'catalog.edit',     false),
  ('viewer', 'catalog.manage',   false),
  ('viewer', 'pages.view',       true),
  ('viewer', 'pages.edit',       false),
  ('viewer', 'pages.publish',    false),
  ('viewer', 'pages.manage',     false),
  ('viewer', 'team.view',        false),
  ('viewer', 'team.invite',      false),
  ('viewer', 'team.manage',      false),
  ('viewer', 'reviews.view',     true),
  ('viewer', 'reviews.respond',  false),
  ('viewer', 'gigs.post',        false),
  ('viewer', 'gigs.manage',      false),
  ('viewer', 'mail.view',        false),
  ('viewer', 'mail.send',        false),
  ('viewer', 'ads.view',         false),
  ('viewer', 'ads.manage',       false),
  ('viewer', 'finance.view',     false),
  ('viewer', 'finance.manage',   false),
  ('viewer', 'insights.view',    false),
  ('viewer', 'sensitive.view',   false)

ON CONFLICT ("role_base", "permission") DO UPDATE
  SET "allowed" = EXCLUDED."allowed";


-- ============================================================
-- Seed: BusinessRolePreset (friendly presets for the UI)
-- ============================================================

INSERT INTO "public"."BusinessRolePreset" ("key", "display_name", "description", "role_base", "grant_perms", "deny_perms", "icon_key", "sort_order")
VALUES
  ('business_owner',   'Owner',           'Full control over the business',                              'owner',  '{}', '{}', 'crown',      10),
  ('business_admin',   'Administrator',   'Manages team, finances, and all business settings',           'admin',  '{}', '{}', 'shield',     20),
  ('content_editor',   'Content Editor',  'Edits profile, catalog, pages, and responds to reviews',      'editor', '{}', '{}', 'edit',       30),
  ('operations_staff', 'Staff',           'Handles day-to-day operations, can view catalog and post gigs','staff', '{}', '{}', 'briefcase',  40),
  ('read_only',        'Viewer',          'Read-only access to public business info',                    'viewer', '{}', '{}', 'eye',        50)

ON CONFLICT ("key") DO UPDATE
  SET "display_name" = EXCLUDED."display_name",
      "description"  = EXCLUDED."description",
      "role_base"    = EXCLUDED."role_base",
      "icon_key"     = EXCLUDED."icon_key",
      "sort_order"   = EXCLUDED."sort_order";
