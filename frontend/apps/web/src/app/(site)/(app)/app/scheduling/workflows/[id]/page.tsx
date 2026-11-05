"use client";

// W16 · H3 — Workflow Editor route. `new` → create; a UUID → edit. The editor
// reads ?eventType for prefill via useSearchParams, so it sits in a Suspense
// boundary per the Next 15 app-router requirement.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import WorkflowEditor from "@/components/scheduling/automations/WorkflowEditor";
import { ShimmerBlock } from "@/components/ui/Shimmer";

export default function WorkflowEditorPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : (raw ?? "new");

  return (
    <Suspense fallback={<EditorFallback />}>
      <WorkflowEditor id={id} />
    </Suspense>
  );
}

function EditorFallback() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <ShimmerBlock className="h-8 w-40 rounded-lg" />
      {[0, 1, 2].map((i) => (
        <ShimmerBlock key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}
