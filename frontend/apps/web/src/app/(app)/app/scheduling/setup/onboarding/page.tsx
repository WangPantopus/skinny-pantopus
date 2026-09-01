// A6 — Home & Business scheduling onboarding (variant chosen by ?pillar=).

import { Suspense } from "react";
import OnboardingWizard from "@/components/scheduling/hub/OnboardingWizard";

export const metadata = {
  title: "Set up scheduling · Pantopus",
};

export default function SchedulingOnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingWizard />
    </Suspense>
  );
}
