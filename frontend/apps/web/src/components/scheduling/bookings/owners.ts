// W8 — Bookings inbox owner/scope helpers. The inbox is owner-polymorphic:
// the host sees bookings across Personal / Home / Business. Web has no global
// identity hook (owner is route-derived), so the inbox resolves the three
// owner contexts locally (mirroring the W1 hub pattern) and queries each one.
//
// Pure helpers (no React) live here so the scope/query logic is unit-testable;
// the resolving hook lives in useScopeOwners.ts.

import type { SchedulingOwnerRef } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling/pillarTokens";

export type Scope = "all" | Pillar;

export interface OwnerOption {
  /** Ref to pass to @pantopus/api scheduling calls, or null if unavailable. */
  owner: SchedulingOwnerRef | null;
  /** Entity name for the row owner-glyph (handle / household / business). */
  name: string;
}

export type ScopeOwners = Record<Pillar, OwnerOption>;

export const PILLAR_ORDER: Pillar[] = ["personal", "home", "business"];

export const PILLAR_LABEL: Record<Pillar, string> = {
  personal: "Personal",
  home: "Home",
  business: "Business",
};

export function ownerKey(owner?: SchedulingOwnerRef | null): string {
  if (!owner) return "none";
  if (owner.ownerType === "home") return `home:${owner.homeId ?? ""}`;
  if (owner.ownerType === "business") return `business:${owner.ownerId ?? ""}`;
  return "user";
}

export function pillarOfOwner(owner?: SchedulingOwnerRef | null): Pillar {
  if (owner?.ownerType === "home") return "home";
  if (owner?.ownerType === "business") return "business";
  return "personal";
}

/** Reassign is only valid for team-backed owners (home/business). */
export function canReassign(owner?: SchedulingOwnerRef | null): boolean {
  return owner?.ownerType === "home" || owner?.ownerType === "business";
}

/** Pillars with a resolved owner (always includes personal). */
export function availablePillars(owners: ScopeOwners): Pillar[] {
  return PILLAR_ORDER.filter((p) => owners[p].owner);
}

export interface ResolvedScopeOwner {
  pillar: Pillar;
  owner: SchedulingOwnerRef;
  name: string;
}

/** The owner(s) to query for a scope. "all" → every resolved owner. */
export function ownersForScope(
  scope: Scope,
  owners: ScopeOwners,
): ResolvedScopeOwner[] {
  const pillars = scope === "all" ? availablePillars(owners) : [scope];
  const out: ResolvedScopeOwner[] = [];
  for (const p of pillars) {
    const o = owners[p];
    if (o.owner) out.push({ pillar: p, owner: o.owner, name: o.name });
  }
  return out;
}

// ─── URL serialization (deep-link a booking detail with its owner) ──

/** owner → query params for `bookings/[id]?ot=&oid=`. Personal → none. */
export function ownerToQuery(
  owner?: SchedulingOwnerRef | null,
): Record<string, string> {
  if (owner?.ownerType === "business" && owner.ownerId) {
    return { ot: "business", oid: owner.ownerId };
  }
  if (owner?.ownerType === "home" && owner.homeId) {
    return { ot: "home", oid: owner.homeId };
  }
  return {};
}

/** Inverse of ownerToQuery. `get` mirrors URLSearchParams.get. */
export function ownerFromQuery(
  get: (key: string) => string | null | undefined,
): SchedulingOwnerRef {
  const ot = get("ot");
  const oid = get("oid");
  if (ot === "business" && oid) return { ownerType: "business", ownerId: oid };
  if (ot === "home" && oid) return { ownerType: "home", homeId: oid };
  return { ownerType: "user" };
}

/** "?ot=business&oid=…" (or "" for personal) for appending to a href. */
export function ownerQueryString(owner?: SchedulingOwnerRef | null): string {
  const s = new URLSearchParams(ownerToQuery(owner)).toString();
  return s ? `?${s}` : "";
}
