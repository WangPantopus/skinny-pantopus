// G5 — Business Scheduling Settings (the business booking hub the W2 editor
// links to for assignment). W13-owned route.

import { Suspense } from "react";
import BusinessSettings from "@/components/scheduling/business/BusinessSettings";

export const metadata = {
  title: "Business booking settings · Pantopus",
};

export default function BusinessSchedulingPage() {
  return (
    <Suspense fallback={null}>
      <BusinessSettings />
    </Suspense>
  );
}
