"use client";

// W17 · H12 — Team Performance (business-only).

import InsightsShell from "@/components/scheduling/insights/InsightsShell";
import TeamPerformance from "@/components/scheduling/insights/TeamPerformance";

export default function TeamPerformancePage() {
  return (
    <InsightsShell
      active="team"
      title="Team performance"
      subtitle="Bookings, revenue and no-shows by member"
    >
      <TeamPerformance />
    </InsightsShell>
  );
}
