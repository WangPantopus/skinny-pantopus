"use client";

// Resolves the three scheduling owner contexts for the owner-polymorphic
// bookings inbox. Web has no global identity hook, so Home/Business owner refs
// are resolved read-only from the user's primary home + first business
// membership. Personal is always available. Mirrors the W1 hub's useHubOwners.

import { useEffect, useState } from "react";
import * as api from "@pantopus/api";
import type { ScopeOwners } from "./owners";

function shortName(value: string | null | undefined, max = 22): string {
  const s = (value || "").trim();
  if (!s) return "";
  // Addresses can be long — take the leading segment, then clamp.
  const head = s.split(",")[0].trim() || s;
  return head.length > max ? `${head.slice(0, max - 1)}…` : head;
}

function initial(): ScopeOwners {
  return {
    personal: { owner: { ownerType: "user" }, name: "Personal" },
    home: { owner: null, name: "Home" },
    business: { owner: null, name: "Business" },
  };
}

export function useScopeOwners(): { owners: ScopeOwners; loading: boolean } {
  const [owners, setOwners] = useState<ScopeOwners>(initial);
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
            name: shortName(home.address) || "Home",
          };
        }
      } catch {
        /* no household — Home scope stays unavailable */
      }
      try {
        const { businesses } = await api.businesses.getMyBusinesses();
        const first = businesses?.[0];
        if (first?.business_user_id) {
          next.business = {
            owner: { ownerType: "business", ownerId: first.business_user_id },
            name:
              shortName(first.business?.name) ||
              shortName(first.title) ||
              "Business",
          };
        }
      } catch {
        /* no business — Business scope stays unavailable */
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
