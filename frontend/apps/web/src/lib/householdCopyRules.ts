// Founder decision 3's rules (lib/householdCopy.ts): which kept copies may show
// before their re-check. Plain functions, so the browser and the server's first
// content (lib/server) apply the same ones. Keep this file dependency-free.
import type { MyHome } from '@pantopus/api';

const HOUSEHOLD = new Set(['owner', 'admin', 'manager', 'lease_resident', 'member', 'restricted_member']);
const PLACE_HOUSEHOLD = new Set(['owner', 'renter', 'member']);

type HomeCopyContext = Pick<MyHome, 'occupancy' | 'access_kind' | 'has_home_access' | 'role_base' | 'can_delete_home'>;

/** One of your homes is an owner's or household member's, with no end date. */
export function showsHomeCopy(home: HomeCopyContext): boolean {
  if (home.occupancy?.end_at != null || home.occupancy?.access_end_at != null
    || typeof home.can_delete_home !== 'boolean') return false;
  if (home.access_kind === 'private_setup') return home.has_home_access === false && home.role_base == null;
  return home.access_kind === 'shared' && home.has_home_access === true && HOUSEHOLD.has(home.role_base ?? '');
}

/** A Home you have asked to claim or join, still in verification, with no end date. */
function isOwnRequest(home: HomeCopyContext): boolean {
  return home.access_kind === 'verification' && home.has_home_access === false
    && home.occupancy?.end_at == null && home.occupancy?.access_end_at == null && typeof home.can_delete_home === 'boolean';
}

/** Your homes list shows before its re-check only when every home on it may, or is your own request. */
export function showsMyHomesCopy(reply: { homes?: MyHome[] } | null | undefined): boolean {
  return !!reply && (reply.homes ?? []).every((home) => showsHomeCopy(home) || isOwnRequest(home));
}

/** A Place read shows before its re-check only to the home's owner, renter or household member. */
export function placeCopyGate(home: MyHome | undefined) {
  return (intelligence: { viewer?: { role?: string | null } | null } | null | undefined): boolean =>
    !!home && showsHomeCopy(home) && PLACE_HOUSEHOLD.has(intelligence?.viewer?.role ?? '');
}

/** Your primary home shows before its re-check when it may (or when you have none). */
export function showsPrimaryCopy(reply: { home: HomeCopyContext | null }): boolean {
  return reply.home === null || showsHomeCopy(reply.home);
}
