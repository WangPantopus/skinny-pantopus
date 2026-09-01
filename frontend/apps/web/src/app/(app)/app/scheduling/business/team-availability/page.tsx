// G3 — Team Booking Availability. W13-owned route.

import { Suspense } from "react";
import TeamAvailabilityGrid from "@/components/scheduling/business/TeamAvailabilityGrid";

export const metadata = {
  title: "Team booking availability · Pantopus",
};

export default function TeamAvailabilityPage() {
  return (
    <Suspense fallback={null}>
      <TeamAvailabilityGrid />
    </Suspense>
  );
}
