"use client";

// W2 — Event Types · B8 Connected calendars. OAuth sync is deferred server-side
// (read returns empty, connect returns 501) so this leads with a "coming soon"
// hero plus provider rows that surface the coming-soon message on Connect.

import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { PillarPill } from "@/components/scheduling/event-types/fields";
import ConnectComingSoon from "@/components/scheduling/event-types/ConnectComingSoon";

export default function ConnectedCalendarsPage() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);

  return (
    <div>
      <header className="mb-4">
        <div className="mb-2">
          <PillarPill pillar={pillar} />
        </div>
        <h1 className="text-xl font-bold text-app-text">Connected calendars</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Check for conflicts and add bookings to your other calendars.
        </p>
      </header>

      <ConnectComingSoon owner={owner} />
    </div>
  );
}
