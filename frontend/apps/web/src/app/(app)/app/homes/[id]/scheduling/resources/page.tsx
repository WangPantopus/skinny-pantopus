"use client";

// F9 — Bookable home resources · list. Home-scheduling route (owner_type=home).

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import { ResourceList } from "@/components/scheduling/home/resources";
import type { ResourcePrefill } from "@/components/scheduling/home/resources";
import {
  RestrictedView,
  ScreenHeader,
} from "@/components/scheduling/home/resources/primitives";

function Content() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const { can, access, loading } = useHomePermissions();

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  const canEdit = can("calendar.edit");
  const canView = can("calendar.view") || !!access?.hasAccess;
  const base = `/app/homes/${homeId}/scheduling/resources`;

  const goNew = (prefill?: ResourcePrefill) => {
    const q = prefill
      ? `?type=${prefill.type}&name=${encodeURIComponent(prefill.name)}`
      : "";
    router.push(`${base}/new${q}`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ScreenHeader
        title="Resources"
        onBack={() => router.back()}
        right={
          canEdit ? (
            <button
              type="button"
              onClick={() => goNew()}
              className="text-sm font-bold text-app-home"
            >
              Add
            </button>
          ) : undefined
        }
      />

      {!loading && !canView ? (
        <RestrictedView />
      ) : (
        <ResourceList
          canEdit={canEdit}
          onOpenResource={(rid) => router.push(`${base}/${rid}`)}
          onAddResource={goNew}
        />
      )}

      {canEdit && canView && (
        <button
          type="button"
          onClick={() => goNew()}
          aria-label="Add resource"
          className="fixed bottom-6 right-6 z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-app-home text-white shadow-[0_8px_24px_rgba(22,163,74,0.4)] transition hover:brightness-105"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

export default function ResourcesPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <Content />
      </HomePermissionsProvider>
    </Suspense>
  );
}
