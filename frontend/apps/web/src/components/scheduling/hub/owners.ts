"use client";

// Resolves the three scheduling owner contexts for the owner-polymorphic Hub.
// Web has no global identity hook (owner is route-derived), so the Hub's pillar
// switcher resolves Home/Business owner refs read-only from the user's primary
// home + first business membership. Personal is always available.

import { useEffect, useState } from "react";
import * as api from "@pantopus/api";
import type { SchedulingOwnerRef } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling/pillarTokens";

export interface OwnerOption {
  /** The ref to pass to @pantopus/api scheduling calls, or null if unavailable. */
  owner: SchedulingOwnerRef | null;
  /** Display name for the owner (handle/household/business). */
  name: string;
}

export type HubOwners = Record<Pillar, OwnerOption>;

const INITIAL: HubOwners = {
  personal: { owner: { ownerType: "user" }, name: "You" },
  home: { owner: null, name: "Household" },
  business: { owner: null, name: "Business" },
};

export function useHubOwners(): { owners: HubOwners; loading: boolean } {
  const [owners, setOwners] = useState<HubOwners>(INITIAL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: HubOwners = {
        personal: { owner: { ownerType: "user" }, name: "You" },
        home: { owner: null, name: "Household" },
        business: { owner: null, name: "Business" },
      };
      try {
        const { home } = await api.homes.getPrimaryHome();
        if (home?.id) {
          next.home = {
            owner: { ownerType: "home", homeId: home.id },
            name: home.address || "Household",
          };
        }
      } catch {
        /* no household — Home pillar stays unavailable */
      }
      try {
        const { businesses } = await api.businesses.getMyBusinesses();
        const first = businesses?.[0];
        if (first?.business_user_id) {
          next.business = {
            owner: { ownerType: "business", ownerId: first.business_user_id },
            name: first.business?.name || first.title || "Business",
          };
        }
      } catch {
        /* no business — Business pillar stays unavailable */
      }
      if (!cancelled) {
        setOwners(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { owners, loading };
}

export const PILLARS: Pillar[] = ["personal", "home", "business"];

export const PILLAR_LABEL: Record<Pillar, string> = {
  personal: "Personal",
  home: "Home",
  business: "Business",
};
