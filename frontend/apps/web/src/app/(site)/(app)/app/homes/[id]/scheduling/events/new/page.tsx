"use client";

// F3 — Home add event (W10). Renders the shared add/edit form in a sheet-style
// page shell; the form owns its own Cancel / title / Save bar.

import { Suspense, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthToken } from "@pantopus/api";
import AddEditEventForm from "@/components/scheduling/home/AddEditEventForm";
import { useHomeRoster } from "@/components/scheduling/home/useHomeRoster";

function NewEventContent() {
  const router = useRouter();
  const params = useParams();
  const homeId = (params?.id ?? "") as string;
  const { members } = useHomeRoster(homeId);

  useEffect(() => {
    if (!getAuthToken()) router.push("/login");
  }, [router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="h-[78vh]">
          <AddEditEventForm
            homeId={homeId}
            members={members}
            onCancel={() => router.back()}
            onSaved={(event) =>
              router.replace(
                `/app/homes/${homeId}/scheduling/events/${event.id}`,
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense>
      <NewEventContent />
    </Suspense>
  );
}
