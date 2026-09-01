"use client";

// F10 — New resource (create). Renders the resource editor in a sheet-style
// page shell; the form owns its Cancel / title / Save bar. Pre-fills from
// ?type=&name= (the F9 templates).

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getAuthToken } from "@pantopus/api";
import type { ResourceType } from "@pantopus/types";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { useHomeRoster } from "@/components/scheduling/home";
import { ResourceEditor } from "@/components/scheduling/home/resources";
import type { ResourcePrefill } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

const VALID_TYPES: ResourceType[] = [
  "room",
  "vehicle",
  "tool",
  "charger",
  "other",
];

function Content() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();
  const homeId = (params?.id ?? "") as string;
  const { members } = useHomeRoster(homeId);
  const { can, loading } = useHomePermissions();

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  const base = `/app/homes/${homeId}/scheduling/resources`;
  const typeParam = search?.get("type");
  const prefill: ResourcePrefill | undefined =
    typeParam && VALID_TYPES.includes(typeParam as ResourceType)
      ? { type: typeParam as ResourceType, name: search?.get("name") ?? "" }
      : undefined;

  if (!loading && !can("calendar.edit")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ScreenHeader title="New resource" onBack={() => router.back()} />
        <RestrictedView message="Only household admins can add resources." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="h-[78vh]">
          <ResourceEditor
            prefill={prefill}
            members={members}
            onCancel={() => router.back()}
            onSaved={(r) => router.replace(`${base}/${r.id}`)}
            onDeleted={() => router.replace(base)}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewResourcePage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
