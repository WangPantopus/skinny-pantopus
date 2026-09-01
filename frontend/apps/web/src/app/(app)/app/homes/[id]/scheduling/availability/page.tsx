"use client";

// F8 — My household availability settings (W10). Exposure-only boundary screen.

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthToken } from "@pantopus/api";
import HouseholdAvailabilityForm from "@/components/scheduling/home/HouseholdAvailabilityForm";

function AvailabilityContent() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-1.5 transition hover:bg-app-surface-sunken"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-app-text" />
        </button>
        <h1 className="text-[15.5px] font-semibold tracking-tight text-app-text">
          My availability
        </h1>
      </div>

      <HouseholdAvailabilityForm homeId={homeId} />
    </div>
  );
}

export default function HouseholdAvailabilityPage() {
  return (
    <Suspense>
      <AvailabilityContent />
    </Suspense>
  );
}
