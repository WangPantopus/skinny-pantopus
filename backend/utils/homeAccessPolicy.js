// Effective Home permission ceilings. Keep this contract aligned with
// home_effective_access in the additive database migration.
const ROLE_RANK = Object.freeze({
  service_provider: 5, guest: 10, restricted_member: 20, member: 30,
  lease_resident: 35, manager: 40, admin: 50, owner: 60,
});
const LEGACY_ROLES = Object.freeze({
  owner: 'owner', admin: 'admin', property_manager: 'manager', manager: 'manager',
  tenant: 'lease_resident', renter: 'lease_resident', lease_resident: 'lease_resident',
  roommate: 'member', family: 'member', member: 'member', caregiver: 'restricted_member',
  restricted_member: 'restricted_member', guest: 'guest', service_provider: 'service_provider',
});
const OLD_TO_NEW_PERM = Object.freeze({
  can_manage_home: ['home.edit'], can_manage_finance: ['finance.manage'],
  can_manage_access: ['access.manage', 'members.manage'],
  can_manage_tasks: ['tasks.edit', 'tasks.manage'], can_view_sensitive: ['sensitive.view'],
});
const HOME_PERMISSIONS = Object.freeze([
  'home.view', 'home.edit', 'members.view', 'members.manage', 'access.view_wifi',
  'access.view_codes', 'access.manage', 'docs.view', 'docs.upload', 'docs.manage',
  'calendar.view', 'calendar.edit', 'calendar.manage', 'tasks.view', 'tasks.edit', 'tasks.manage',
  'maintenance.view', 'maintenance.edit', 'maintenance.manage', 'assets.view', 'assets.manage',
  'devices.view', 'devices.manage', 'vendors.view', 'vendors.manage', 'packages.view',
  'packages.edit', 'packages.manage', 'mailbox.view', 'mailbox.manage', 'finance.view',
  'finance.manage', 'sensitive.view', 'verification.manage', 'ownership.view',
  'ownership.manage', 'ownership.transfer', 'security.manage', 'dispute.view',
  'dispute.manage', 'quorum.vote', 'quorum.propose',
]);
const CHILD_PERMISSIONS = new Set([
  'home.view', 'members.view', 'tasks.view', 'calendar.view', 'docs.view', 'packages.view',
  'maintenance.view', 'assets.view', 'devices.view', 'vendors.view',
]);
const TEEN_PERMISSIONS = new Set([
  ...CHILD_PERMISSIONS, 'tasks.edit', 'calendar.edit', 'docs.upload', 'maintenance.edit', 'packages.edit',
]);

function resolveHomeRole(occupancy) {
  if (!occupancy) return null;
  if (occupancy.role_base != null) {
    return Object.hasOwn(ROLE_RANK, occupancy.role_base) ? occupancy.role_base : null;
  }
  return Object.hasOwn(LEGACY_ROLES, occupancy.role) ? LEGACY_ROLES[occupancy.role] : null;
}

function currentOccupancy(occupancy, now = Date.now()) {
  if (occupancy?.is_active !== true) return false;
  for (const column of ['start_at', 'access_start_at']) {
    if (occupancy[column] == null) continue;
    const time = new Date(occupancy[column]).getTime();
    if (!Number.isFinite(time) || time > now) return false;
  }
  for (const column of ['end_at', 'access_end_at']) {
    if (occupancy[column] == null) continue;
    const time = new Date(occupancy[column]).getTime();
    if (!Number.isFinite(time) || time <= now) return false;
  }
  return true;
}

function ageAllows(age, permission) {
  if (!HOME_PERMISSIONS.includes(permission)) return false;
  if (age == null || age === 'adult') return true;
  if (age === 'child') return CHILD_PERMISSIONS.has(permission);
  if (age === 'teen') return TEEN_PERMISSIONS.has(permission);
  return false;
}

function effectiveRole(role, age) {
  const ceiling = age === 'child' ? 'restricted_member' : age === 'teen' ? 'member' : role;
  return (ROLE_RANK[role] || 0) > (ROLE_RANK[ceiling] || 0) ? ceiling : role;
}

module.exports = { ROLE_RANK, OLD_TO_NEW_PERM, HOME_PERMISSIONS, resolveHomeRole,
  currentOccupancy, ageAllows, effectiveRole };
