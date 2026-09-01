// Pure SchedulingOwner helpers (no React) so they're trivially unit-testable
// and reusable by custom fetches. The SchedulingOwnerProvider wraps
// detectOwnerFromPath; ownerToParams mirrors the api routing for the rare case
// a stream builds a request outside the @pantopus/api scheduling helpers.

import type { SchedulingOwnerRef } from "@pantopus/types";

/** Derive the active owner from the route, mirroring AppShell's URL parsing. */
export function detectOwnerFromPath(
  pathname: string | null,
): SchedulingOwnerRef {
  if (pathname) {
    const home = pathname.match(/\/app\/homes\/([^/]+)/);
    if (home?.[1] && home[1] !== "find" && home[1] !== "new") {
      return { ownerType: "home", homeId: home[1] };
    }
    const biz = pathname.match(/\/app\/businesses\/([^/]+)/);
    if (biz?.[1] && biz[1] !== "new") {
      return { ownerType: "business", ownerId: biz[1] };
    }
  }
  return { ownerType: "user" };
}

/**
 * Owner identity params per the GLOBAL WIRING CONTRACT:
 *   personal → {} ; business → owner_type/owner_id ; home → mirrored.
 * Matches packages/api/src/endpoints/scheduling.ts.
 */
export function ownerToParams(
  owner?: SchedulingOwnerRef,
): Record<string, string> {
  if (owner?.ownerType === "business" && owner.ownerId) {
    return { owner_type: "business", owner_id: owner.ownerId };
  }
  if (owner?.ownerType === "home" && owner.homeId) {
    return { owner_type: "home", owner_id: owner.homeId };
  }
  return {};
}
