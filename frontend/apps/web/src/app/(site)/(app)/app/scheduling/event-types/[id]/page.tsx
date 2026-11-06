"use client";

// W2 — Event Types · B2 editor route. `new` → create mode; a UUID → edit mode.
// The editor uses useSearchParams (?duration template preset), so it sits inside
// a Suspense boundary per the Next 15 app-router requirement.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import EventTypeForm from "@/components/scheduling/event-types/EventTypeForm";
import { ShimmerBlock } from "@/components/ui/Shimmer";

export default function EventTypeEditorPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : (raw ?? "new");

  return (
    <Suspense fallback={<EditorFallback />}>
      <EventTypeForm id={id} />
    </Suspense>
  );
}

function EditorFallback() {
  return (
    <div className="flex flex-col gap-3">
      <ShimmerBlock className="h-9 w-48 rounded-lg" />
      {[0, 1, 2].map((i) => (
        <ShimmerBlock key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}
