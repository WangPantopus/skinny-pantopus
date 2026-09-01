"use client";

// F10 — Edit resource. Loads the resource, then renders the editor (partial PUT
// on save, soft-delete on delete). Admin-only.

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getAuthToken, scheduling } from "@pantopus/api";
import type { Resource } from "@pantopus/types";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { useSchedulingOwner } from "@/components/scheduling";
import { useHomeRoster } from "@/components/scheduling/home";
import { ResourceEditor } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

function Content() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const rid = (params?.rid ?? "") as string;
  const owner = useSchedulingOwner();
  const { members } = useHomeRoster(homeId);
  const { can, loading: permLoading } = useHomePermissions();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    scheduling
      .listResources(owner)
      .then((res) => {
        if (cancelled) return;
        const found = res.resources.find((r) => r.id === rid) ?? null;
        setResource(found);
        setNotFound(!found);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [owner, rid]);

  const base = `/app/homes/${homeId}/scheduling/resources`;

  if (!permLoading && !can("calendar.edit")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ScreenHeader title="Edit resource" onBack={() => router.back()} />
        <RestrictedView message="Only household admins can edit resources." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex h-[78vh] flex-col">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-app-text-muted" />
            </div>
          ) : notFound || !resource ? (
            <div className="flex flex-1 items-center justify-center px-7 text-center text-[13px] text-app-text-secondary">
              This resource no longer exists.
            </div>
          ) : (
            <ResourceEditor
              resource={resource}
              members={members}
              onCancel={() => router.push(`${base}/${rid}`)}
              onSaved={() => router.push(`${base}/${rid}`)}
              onDeleted={() => router.replace(base)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditResourcePage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
