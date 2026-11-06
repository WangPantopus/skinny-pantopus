"use client";

// W17 · H11 — No-Show & Cancellation Report.

import InsightsShell from "@/components/scheduling/insights/InsightsShell";
import NoShowReport from "@/components/scheduling/insights/NoShowReport";

export default function NoShowReportPage() {
  return (
    <InsightsShell
      active="no-shows"
      title="No-shows & cancellations"
      subtitle="Attendance and cancellation trends"
    >
      <NoShowReport />
    </InsightsShell>
  );
}
