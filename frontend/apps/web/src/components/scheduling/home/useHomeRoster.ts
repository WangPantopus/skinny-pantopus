"use client";

// Shared roster loader for the home scheduling screens: resolves household
// members (for avatars / assign-to / RSVP names) and the signed-in user id
// (for "Mine", "your RSVP", and "my assignments").

import { useEffect, useState } from "react";
import * as api from "@pantopus/api";
import { toMember, type HomeMember } from "./helpers";

export interface HomeRoster {
  members: HomeMember[];
  membersById: Map<string, HomeMember>;
  currentUserId: string | null;
  loading: boolean;
}

export function useHomeRoster(homeId: string | undefined): HomeRoster {
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [membersById, setMembersById] = useState<Map<string, HomeMember>>(
    new Map(),
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!homeId) return;
    let cancelled = false;
    (async () => {
      const [occRes, meRes] = await Promise.allSettled([
        api.homes.getHomeOccupants(homeId),
        api.users.getMyProfile(),
      ]);
      if (cancelled) return;
      if (occRes.status === "fulfilled") {
        const ms = (occRes.value.occupants || [])
          .filter((o) => o.user)
          .map((o) => toMember(o.user));
        const map = new Map<string, HomeMember>();
        for (const m of ms) map.set(m.id, m);
        setMembers(ms);
        setMembersById(map);
      }
      if (meRes.status === "fulfilled") {
        const me = meRes.value as { id?: string };
        setCurrentUserId(me?.id ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [homeId]);

  return { members, membersById, currentUserId, loading };
}
