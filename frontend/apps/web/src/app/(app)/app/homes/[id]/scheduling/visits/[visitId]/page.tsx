"use client";

// F14 — Visit detail. Reads the visit (a HomeCalendarEvent) and exposes
// reschedule / cancel for admins. NOTE: the route slug is [visitId] (not [id])
// because Next.js forbids reusing the parent home's [id] slug name in the same
// path.

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { useHomeRoster } from "@/components/scheduling/home";
import { VisitDetail } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

function Content() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const visitId = (params?.visitId ?? "") as string;
  const { membersById } = useHomeRoster(homeId);
  const { can, access, loading } = useHomePermissions();

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  const canEdit = can("calendar.edit");
  const canView = can("calendar.view") || !!access?.hasAccess;
  const calendar = `/app/homes/${homeId}/calendar`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ScreenHeader title="Visit" onBack={() => router.push(calendar)} />
      {!loading && !canView ? (
        <RestrictedView />
      ) : (
        <VisitDetail
          homeId={homeId}
          visitId={visitId}
          canEdit={canEdit}
          membersById={membersById}
          onBack={() => router.push(calendar)}
          onBookAgain={() =>
            router.push(`/app/homes/${homeId}/scheduling/visits/new`)
          }
        />
      )}
    </div>
  );
}

export default function VisitDetailPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
