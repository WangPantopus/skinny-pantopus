"use client";

// W2 — Event Types · B3 Intake questions, full-page variant (the same editor
// the B2 sheet uses). Reachable directly and from the scheduling nav; the B2
// editor opens the editor as a local sheet. Questions persist via PUT
// /event-types/:id/questions (replace semantics).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as api from "@pantopus/api";
import type { IntakeQuestion } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { EditorHeader } from "@/components/scheduling/event-types/EventTypeForm";
import IntakeQuestionsEditor from "@/components/scheduling/event-types/IntakeQuestionsEditor";

export default function IntakeQuestionsPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : (raw ?? "new");
  const router = useRouter();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);

  const editorPath = `/app/scheduling/event-types/${id}`;

  const load = useCallback(() => {
    if (id === "new") {
      setPhase("ready");
      return undefined;
    }
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getEventType(id, owner)
      .then((detail) => {
        if (!alive) return;
        setName(detail.eventType.name);
        setQuestions(detail.questions ?? []);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [id, owner]);

  useEffect(() => load(), [load]);

  if (id === "new") {
    return (
      <div>
        <EditorHeader
          title="Intake questions"
          pillar={pillar}
          onBack={() => router.push("/app/scheduling/event-types")}
        />
        <div className="rounded-2xl border border-app-border bg-app-surface p-6 text-center shadow-sm">
          <p className="text-sm text-app-text-secondary">
            Save the event type first, then add intake questions.
          </p>
          <Link
            href="/app/scheduling/event-types/new"
            className="mt-3 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Create event type
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div>
        <EditorHeader
          title="Intake questions"
          pillar={pillar}
          onBack={() => router.push(editorPath)}
        />
        <div className="flex flex-col gap-3">
          <ShimmerBlock className="h-24 rounded-2xl" />
          <ShimmerBlock className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div>
        <EditorHeader
          title="Intake questions"
          pillar={pillar}
          onBack={() => router.push(editorPath)}
        />
        <ErrorState
          message="We couldn't load this event type."
          onRetry={load}
        />
      </div>
    );
  }

  // Build the pillar-accent overline: "Personal · Intro call" style, matching the design's sheet header.
  const pillarLabel =
    pillar === "business"
      ? "Business"
      : pillar === "home"
        ? "Home"
        : "Personal";
  const overline = name ? `${pillarLabel} · ${name}` : pillarLabel;

  return (
    <div className="pb-10">
      <EditorHeader
        title="Intake questions"
        pillar={pillar}
        onBack={() => router.push(editorPath)}
        overline={overline}
      />
      <div className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
        <IntakeQuestionsEditor
          eventTypeId={id}
          owner={owner}
          initialQuestions={questions}
          variant="page"
          onSaved={(qs) => setQuestions(qs)}
        />
      </div>
    </div>
  );
}
