"use client";

// F1 — Household calendar / agenda (W10). Extends the existing home calendar
// route to render the booking UNION (GET /api/homes/:id/events, rows tagged
// source:'booking') alongside household events, with a member filter, assignee
// avatar stacks, a create menu, and a "Who's free" entry. Read-only/gated for
// members lacking calendar.edit (F15 render-mode). W10 is the sole owner of
// this file.

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import HomeAgenda from "@/components/scheduling/home/HomeAgenda";

function CalendarContent() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const { can, loading: permsLoading } = useHomePermissions();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  useEffect(() => {
    api.users
      .getMyProfile()
      .then((u) => setCurrentUserId((u as { id?: string })?.id ?? null))
      .catch(() => {});
  }, []);

  const canEdit = can("calendar.edit");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-1.5 transition hover:bg-app-surface-sunken"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-app-text" />
          </button>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-home">
              Household
            </div>
            <h1 className="text-xl font-bold text-app-text">Calendar</h1>
          </div>
        </div>
        <button
          onClick={() =>
            router.push(`/app/homes/${homeId}/scheduling/whos-free`)
          }
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-bold text-app-home transition hover:bg-app-home-bg"
        >
          <Users className="h-4 w-4" /> Who&apos;s free
        </button>
      </div>

      {permsLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-[88px] rounded-2xl bg-app-surface-sunken" />
          <div className="h-9 w-48 rounded-full bg-app-surface-sunken" />
          <div className="h-[64px] rounded-2xl bg-app-surface-sunken" />
          <div className="h-[64px] rounded-2xl bg-app-surface-sunken" />
        </div>
      ) : (
        <HomeAgenda
          homeId={homeId}
          canEdit={canEdit}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

export default function CalendarPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <CalendarContent />
      </HomePermissionsProvider>
    </Suspense>
  );
}
