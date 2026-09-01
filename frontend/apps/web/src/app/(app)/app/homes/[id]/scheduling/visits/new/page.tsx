"use client";

// F13 — Schedule a visit (setup). Admin-only (POST /visits is owner edit).
// Creates a single household visit event and lands on the visit detail.

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { useHomeRoster } from "@/components/scheduling/home";
import { VisitSetup } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

function Content() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const { members } = useHomeRoster(homeId);
  const { can, loading } = useHomePermissions();

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  const base = `/app/homes/${homeId}/scheduling/visits`;

  if (!loading && !can("calendar.edit")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ScreenHeader title="Schedule a visit" onBack={() => router.back()} />
        <RestrictedView message="Only household admins can schedule visits." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="h-[80vh]">
          <VisitSetup
            members={members}
            onCancel={() => router.back()}
            onCreated={(visitId) => router.replace(`${base}/${visitId}`)}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewVisitPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
