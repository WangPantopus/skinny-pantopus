"use client";

// F15 — Permission-gated scheduler home (W10). Members with calendar.edit see a
// hub of scheduling surfaces; members without it get the calendar in read-only
// render-mode (handled inside PermissionGate / HomeAgenda).

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, ShieldPlus } from "lucide-react";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import { HomePermissionsProvider, useHomePermissions } from "@/components/home/useHomePermissions";
import PermissionGate from "@/components/scheduling/home/PermissionGate";

const ACCESS_KEY = (homeId: string) => `pantopus.home-sched-access.${homeId}`;

function SchedulerContent() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const { can, loading: permsLoading } = useHomePermissions();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accessRequested, setAccessRequested] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  useEffect(() => {
    api.users
      .getMyProfile()
      .then((u) => setCurrentUserId((u as { id?: string })?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAccessRequested(
        window.localStorage.getItem(ACCESS_KEY(homeId)) === "1",
      );
    }
  }, [homeId]);

  const canEdit = !permsLoading && can("calendar.edit");
  const isGated = !permsLoading && !canEdit;

  const handleRequestAccess = () => {
    window.localStorage.setItem(ACCESS_KEY(homeId), "1");
    setAccessRequested(true);
    // toast not imported here — HomeAgenda will show it via its own fallback if
    // needed; we handle the state purely here for the top-bar pill.
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* F15 top bar: title "Calendar" left + access pill right (gated mode only) */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-1.5 transition hover:bg-app-surface-sunken"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-app-text" />
        </button>
        <div className="flex flex-1 items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-home">
              Household
            </div>
            <h1 className="text-xl font-bold text-app-text">Calendar</h1>
          </div>
          {/* Access pill — only in gated (read-only) mode */}
          {isGated && (
            accessRequested ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-app-surface-sunken px-2.5 py-1 text-[11px] font-bold text-app-text-muted">
                <Clock className="h-3 w-3" /> Request sent
              </span>
            ) : (
              <button
                onClick={handleRequestAccess}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-app-home/30 bg-app-home-bg px-2.5 py-1 text-[11px] font-bold text-app-home"
              >
                <ShieldPlus className="h-3 w-3" /> Ask to manage
              </button>
            )
          )}
        </div>
      </div>

      <PermissionGate
        homeId={homeId}
        currentUserId={currentUserId}
        accessRequested={accessRequested}
        onRequestAccess={isGated ? handleRequestAccess : undefined}
      />
    </div>
  );
}

export default function SchedulerPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <SchedulerContent />
      </HomePermissionsProvider>
    </Suspense>
  );
}
