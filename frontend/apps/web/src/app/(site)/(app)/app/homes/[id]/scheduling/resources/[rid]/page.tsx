"use client";

// F11 — Resource detail / booking calendar. Header card + rules + the resource's
// bookings + (admin) approval queue + a sticky Book this.

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { useHomeRoster } from "@/components/scheduling/home";
import { ResourceDetail } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

function Content() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const rid = (params?.rid ?? "") as string;
  const { membersById } = useHomeRoster(homeId);
  const { can, access, loading } = useHomePermissions();
  const [title, setTitle] = useState("Resource");

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  const canEdit = can("calendar.edit");
  const canView = can("calendar.view") || !!access?.hasAccess;
  const base = `/app/homes/${homeId}/scheduling/resources`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ScreenHeader
        title={title}
        onBack={() => router.push(base)}
        right={
          canEdit ? (
            <button
              type="button"
              onClick={() => router.push(`${base}/${rid}/edit`)}
              className="text-sm font-bold text-app-home"
            >
              Edit
            </button>
          ) : undefined
        }
      />

      {!loading && !canView ? (
        <RestrictedView />
      ) : (
        <ResourceDetail
          rid={rid}
          canEdit={canEdit}
          membersById={membersById}
          onTitle={setTitle}
          onBook={(opts) =>
            router.push(
              `${base}/${rid}/book${opts?.date ? `?date=${opts.date}` : ""}`,
            )
          }
        />
      )}
    </div>
  );
}

export default function ResourceDetailPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
