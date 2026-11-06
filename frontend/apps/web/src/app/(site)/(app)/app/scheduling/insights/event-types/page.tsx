"use client";

// W17 · H10 — Per-Event-Type Performance.

import InsightsShell from "@/components/scheduling/insights/InsightsShell";
import EventTypePerformance from "@/components/scheduling/insights/EventTypePerformance";

export default function EventTypePerformancePage() {
  return (
    <InsightsShell
      active="event-types"
      title="Per-event-type performance"
      subtitle="How each event type performs over the period"
    >
      <EventTypePerformance />
    </InsightsShell>
  );
}
