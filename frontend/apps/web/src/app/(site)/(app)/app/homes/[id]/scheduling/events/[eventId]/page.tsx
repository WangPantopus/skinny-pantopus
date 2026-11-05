"use client";

// F2 — Home event detail + RSVP (W10). canEdit gates the Edit/Delete footer;
// every member can record their own RSVP.

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthToken } from "@pantopus/api";
import {
  HomePermissionsProvider,
  useHomePermissions,
} from "@/components/home/useHomePermissions";
import EventDetailRsvp from "@/components/scheduling/home/EventDetailRsvp";
import { useHomeRoster } from "@/components/scheduling/home/useHomeRoster";

function EventDetailContent() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const eventId = (params?.eventId ?? "") as string;
  const { can } = useHomePermissions();
  const { members, membersById, currentUserId } = useHomeRoster(homeId);

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-2 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-1.5 transition hover:bg-app-surface-sunken"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-app-text" />
        </button>
        <h1 className="text-base font-bold text-app-text">Event</h1>
      </div>

      <EventDetailRsvp
        homeId={homeId}
        eventId={eventId}
        members={members}
        membersById={membersById}
        currentUserId={currentUserId}
        canEdit={can("calendar.edit")}
        onBack={() => router.push(`/app/homes/${homeId}/calendar`)}
      />
    </div>
  );
}

export default function EventDetailPage() {
  const homeId = (useParams()?.id ?? "") as string;
  return (
    <Suspense>
      <HomePermissionsProvider homeId={homeId}>
        <EventDetailContent />
      </HomePermissionsProvider>
    </Suspense>
  );
}
