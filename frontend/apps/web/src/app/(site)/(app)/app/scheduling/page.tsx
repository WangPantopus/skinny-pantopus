// A1 — Scheduling Hub (the section index W0 left for W1). Owner-polymorphic
// front door; all logic lives in the client SchedulingHub component.

import SchedulingHub from "@/components/scheduling/hub/SchedulingHub";

export const metadata = {
  title: "Scheduling · Pantopus",
};

export default function SchedulingHubPage() {
  return <SchedulingHub />;
}
