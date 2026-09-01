"use client";

// W17 — resolve the three scheduling owner contexts for the insights reports.
// Web has no global identity hook (owner is route-derived, and /app/scheduling
// resolves to personal), so — like the Hub's pillar switcher — we resolve the
// Home/Business owner refs read-only from the user's primary home + first
// business membership. Personal is always available. Kept in the stream's own
// folder so W17 stays disjoint from W1.

import { useEffect, useState } from "react";
import * as api from "@pantopus/api";
import type { SchedulingOwnerRef } from "@pantopus/types";
import type { Pillar } from "@/components/scheduling/pillarTokens";

export interface OwnerOption {
  owner: SchedulingOwnerRef | null;
  name: string;
}

export type InsightsOwners = Record<Pillar, OwnerOption>;

function initial(): InsightsOwners {
  return {
    personal: { owner: { ownerType: "user" }, name: "Personal" },
    home: { owner: null, name: "Household" },
    business: { owner: null, name: "Business" },
  };
}

export function useInsightsOwners(): {
  owners: InsightsOwners;
  loading: boolean;
} {
  const [owners, setOwners] = useState<InsightsOwners>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = initial();
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

export const PILLAR_ORDER: Pillar[] = ["personal", "home", "business"];
