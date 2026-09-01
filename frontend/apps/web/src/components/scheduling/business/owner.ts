"use client";

// Resolves the active Business scheduling owner for W13. The host scheduling
// routes live under /app/scheduling/* (not /app/businesses/:id), so route-based
// owner detection yields "personal" here — every Business surface must resolve
// the active business itself and pass an explicit owner ref. We read the user's
// business memberships and let them switch when they own more than one; the
// chosen `business_user_id` becomes `owner_id` on every scheduling call (the
// GLOBAL WIRING CONTRACT: business → owner_type:'business' + owner_id).

import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@pantopus/api";
import type { BusinessMembership, SchedulingOwnerRef } from "@pantopus/types";

export interface BusinessOption {
  /** business_user_id — the scheduling owner_id. */
  id: string;
  name: string;
  /** The membership role/title, when present. */
  role: string;
}

/** Pure: map a membership → the SchedulingOwnerRef every api call expects. */
export function businessOwnerRef(
  membership: Pick<BusinessMembership, "business_user_id"> | null | undefined,
): SchedulingOwnerRef | null {
  const id = membership?.business_user_id;
  return id ? { ownerType: "business", ownerId: id } : null;
}

/** Pure: normalise memberships → switcher options (deduped, stable order). */
export function businessOptions(
  memberships: BusinessMembership[] | undefined,
): BusinessOption[] {
  const seen = new Set<string>();
  const out: BusinessOption[] = [];
  for (const m of memberships ?? []) {
    const id = m.business_user_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: m.business?.name || m.title || "Business",
      role: m.title || m.role_base || "",
    });
  }
  return out;
}

export interface UseBusinessOwner {
  loading: boolean;
  /** True once resolved and the user belongs to no business. */
  unavailable: boolean;
  options: BusinessOption[];
  active: BusinessOption | null;
  owner: SchedulingOwnerRef | null;
  setActiveId: (id: string) => void;
}

/**
 * Resolve the active business owner. Defaults to the first membership; persists
 * the chosen business for the session via a `business` query param hook handled
 * by the caller (kept lightweight here — just in-memory selection).
 */
export function useBusinessOwner(initialId?: string | null): UseBusinessOwner {
  const [options, setOptions] = useState<BusinessOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialId ?? null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { businesses } = await api.businesses.getMyBusinesses();
        const opts = businessOptions(businesses);
        if (cancelled) return;
        setOptions(opts);
        setActiveId((prev) =>
          prev && opts.some((o) => o.id === prev)
            ? prev
            : (opts[0]?.id ?? null),
        );
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) {
          setResolved(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo<BusinessOption | null>(
    () => options.find((o) => o.id === activeId) ?? options[0] ?? null,
    [options, activeId],
  );

  const owner = useMemo<SchedulingOwnerRef | null>(
    () => (active ? { ownerType: "business", ownerId: active.id } : null),
    [active],
  );

  const choose = useCallback((id: string) => setActiveId(id), []);

  return {
    loading,
    unavailable: resolved && options.length === 0,
    options,
    active,
    owner,
    setActiveId: choose,
  };
}
