// W15 · G8 — Packages List route. Thin client wrapper; the screen, data, and
// states live in the stream-owned PackageList component. Packages are a business
// surface, so the active business owner is resolved here (not personal).

"use client";

import { PackageList } from "@/components/scheduling/packages";
import BusinessOwnerBoundary from "@/components/scheduling/business/BusinessOwnerBoundary";

export default function PackagesPage() {
  return (
    <BusinessOwnerBoundary>
      {(owner) => <PackageList owner={owner} />}
    </BusinessOwnerBoundary>
  );
}
