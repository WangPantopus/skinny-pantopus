-- Business role defaults. A business's admin, editor, staff and viewer seats get
-- their permissions from these rows (owners get every permission in code), but
-- only backend/database/seed_business_role_permissions.sql inserted them, never a
-- migration, so a database built from migrations has none. There every non-owner
-- seat is refused every business permission unless it has a per-person override:
-- an editor can't edit the profile, catalog or pages, staff can't answer the
-- business inbox, and a letter sent as the business goes out under the person's
-- own name. These are exactly the seed's 116 rows (64 grants).
--
-- Backwards compatible: yes. No schema, policy, function or response changes:
-- the API, the apps and business_has_permission() already read these rows.
-- Rows already present win (ON CONFLICT DO NOTHING), so a role default set by
-- hand, an explicit false included, is kept, and per-person and per-seat
-- overrides still come first.
SET LOCAL lock_timeout = '5s';

INSERT INTO public."BusinessRolePermission" (role_base, permission, allowed)
VALUES
  -- admin: every business permission (owners get all of them in code)
  ('admin', 'profile.view', true),
  ('admin', 'profile.edit', true),
  ('admin', 'locations.view', true),
  ('admin', 'locations.edit', true),
  ('admin', 'locations.manage', true),
  ('admin', 'hours.view', true),
  ('admin', 'hours.edit', true),
  ('admin', 'catalog.view', true),
  ('admin', 'catalog.edit', true),
  ('admin', 'catalog.manage', true),
  ('admin', 'pages.view', true),
  ('admin', 'pages.edit', true),
  ('admin', 'pages.publish', true),
  ('admin', 'pages.manage', true),
  ('admin', 'team.view', true),
  ('admin', 'team.invite', true),
  ('admin', 'team.manage', true),
  ('admin', 'reviews.view', true),
  ('admin', 'reviews.respond', true),
  ('admin', 'gigs.post', true),
  ('admin', 'gigs.manage', true),
  ('admin', 'mail.view', true),
  ('admin', 'mail.send', true),
  ('admin', 'ads.view', true),
  ('admin', 'ads.manage', true),
  ('admin', 'finance.view', true),
  ('admin', 'finance.manage', true),
  ('admin', 'insights.view', true),
  ('admin', 'sensitive.view', true),

  -- editor: edits the profile, locations, hours, catalog and pages, answers reviews, posts tasks and
  -- sends mail; can't manage the team, money or sensitive data
  ('editor', 'profile.view', true),
  ('editor', 'profile.edit', true),
  ('editor', 'locations.view', true),
  ('editor', 'locations.edit', true),
  ('editor', 'locations.manage', false),
  ('editor', 'hours.view', true),
  ('editor', 'hours.edit', true),
  ('editor', 'catalog.view', true),
  ('editor', 'catalog.edit', true),
  ('editor', 'catalog.manage', false),
  ('editor', 'pages.view', true),
  ('editor', 'pages.edit', true),
  ('editor', 'pages.publish', true),
  ('editor', 'pages.manage', false),
  ('editor', 'team.view', true),
  ('editor', 'team.invite', false),
  ('editor', 'team.manage', false),
  ('editor', 'reviews.view', true),
  ('editor', 'reviews.respond', true),
  ('editor', 'gigs.post', true),
  ('editor', 'gigs.manage', false),
  ('editor', 'mail.view', true),
  ('editor', 'mail.send', true),
  ('editor', 'ads.view', true),
  ('editor', 'ads.manage', false),
  ('editor', 'finance.view', false),
  ('editor', 'finance.manage', false),
  ('editor', 'insights.view', true),
  ('editor', 'sensitive.view', false),

  -- staff: posts tasks, answers the business inbox and sends mail; views the business, edits nothing
  ('staff', 'profile.view', true),
  ('staff', 'profile.edit', false),
  ('staff', 'locations.view', true),
  ('staff', 'locations.edit', false),
  ('staff', 'locations.manage', false),
  ('staff', 'hours.view', true),
  ('staff', 'hours.edit', false),
  ('staff', 'catalog.view', true),
  ('staff', 'catalog.edit', false),
  ('staff', 'catalog.manage', false),
  ('staff', 'pages.view', true),
  ('staff', 'pages.edit', false),
  ('staff', 'pages.publish', false),
  ('staff', 'pages.manage', false),
  ('staff', 'team.view', true),
  ('staff', 'team.invite', false),
  ('staff', 'team.manage', false),
  ('staff', 'reviews.view', true),
  ('staff', 'reviews.respond', false),
  ('staff', 'gigs.post', true),
  ('staff', 'gigs.manage', false),
  ('staff', 'mail.view', true),
  ('staff', 'mail.send', true),
  ('staff', 'ads.view', false),
  ('staff', 'ads.manage', false),
  ('staff', 'finance.view', false),
  ('staff', 'finance.manage', false),
  ('staff', 'insights.view', false),
  ('staff', 'sensitive.view', false),

  -- viewer: reads the public-facing sections only
  ('viewer', 'profile.view', true),
  ('viewer', 'profile.edit', false),
  ('viewer', 'locations.view', true),
  ('viewer', 'locations.edit', false),
  ('viewer', 'locations.manage', false),
  ('viewer', 'hours.view', true),
  ('viewer', 'hours.edit', false),
  ('viewer', 'catalog.view', true),
  ('viewer', 'catalog.edit', false),
  ('viewer', 'catalog.manage', false),
  ('viewer', 'pages.view', true),
  ('viewer', 'pages.edit', false),
  ('viewer', 'pages.publish', false),
  ('viewer', 'pages.manage', false),
  ('viewer', 'team.view', false),
  ('viewer', 'team.invite', false),
  ('viewer', 'team.manage', false),
  ('viewer', 'reviews.view', true),
  ('viewer', 'reviews.respond', false),
  ('viewer', 'gigs.post', false),
  ('viewer', 'gigs.manage', false),
  ('viewer', 'mail.view', false),
  ('viewer', 'mail.send', false),
  ('viewer', 'ads.view', false),
  ('viewer', 'ads.manage', false),
  ('viewer', 'finance.view', false),
  ('viewer', 'finance.manage', false),
  ('viewer', 'insights.view', false),
  ('viewer', 'sensitive.view', false)
ON CONFLICT (role_base, permission) DO NOTHING;
