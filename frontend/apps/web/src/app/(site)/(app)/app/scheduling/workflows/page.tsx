// W16 · H2 — Workflows List route.

import WorkflowList from "@/components/scheduling/automations/WorkflowList";

export const metadata = {
  title: "Workflows · Pantopus",
};

export default function SchedulingWorkflowsPage() {
  return <WorkflowList />;
}
