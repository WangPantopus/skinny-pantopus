"use client";

// W17 · H9 — Insights Dashboard (the section's `insights` index). The reporting
// home with period-scoped KPIs, volume trend, top event types, a live snapshot
// and links into the detail reports. H13 (Period & Filter) opens as a local
// sheet from the shell header.

import InsightsShell from "@/components/scheduling/insights/InsightsShell";
import InsightsDashboard from "@/components/scheduling/insights/InsightsDashboard";

export default function InsightsDashboardPage() {
  return (
    <InsightsShell
      active="dashboard"
      title="Dashboard"
      subtitle="Your scheduling at a glance"
    >
      <InsightsDashboard />
    </InsightsShell>
  );
}
