"use client";

// F12 — Book a resource. Members (calendar.view) can book; the form handles the
// hour grid, conflicts and the confirmed / approval-requested outcomes.

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { useHomeRoster } from "@/components/scheduling/home";
import { BookResource } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

function Content() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const homeId = (params?.id ?? "") as string;
  const rid = (params?.rid ?? "") as string;
  const { members, membersById, currentUserId } = useHomeRoster(homeId);
  const { can, access, loading } = useHomePermissions();

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  const canView = can("calendar.view") || !!access?.hasAccess;
  const base = `/app/homes/${homeId}/scheduling/resources`;

  if (!loading && !canView) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ScreenHeader title="Book a resource" onBack={() => router.back()} />
        <RestrictedView />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="h-[80vh]">
          <BookResource
            rid={rid}
            members={members}
            membersById={membersById}
            currentUserId={currentUserId}
            initialDate={search?.get("date") ?? undefined}
            onCancel={() => router.push(`${base}/${rid}`)}
            onBooked={() => router.push(`/app/homes/${homeId}/calendar`)}
          />
        </div>
      </div>
    </div>
  );
}

export default function BookResourcePage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
