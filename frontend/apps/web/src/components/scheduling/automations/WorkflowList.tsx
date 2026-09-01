"use client";

// W16 · H2 — Workflows List. The automations home: a scope selector (Global vs a
// chosen event type), a pinned "Default reminders" card that opens H1, and the
// grouped list of workflow rows (trigger summary, action + channels, status chip,
// active toggle). FAB/"New" routes to the H3 editor. Backed by GET /workflows,
// PUT /workflows/:id (toggle is_active). Personal sky pillar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bell, CloudOff, Lock, Plus, Workflow as WorkflowIcon } from "lucide-react";
import * as api from "@pantopus/api";
import type { EventType, Workflow } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import { toast } from "@/components/ui/toast-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import {
  Card,
  Chip,
  IconTile,
  Overline,
  Row,
  Toggle,
  UnderlineTabs,
} from "./kit";
import {
  actionMeta,
  actionSummary,
  triggerMeta,
  triggerSummary,
} from "./workflowMeta";
import { readReminders, summarizeReminders } from "./reminders";

type Scope = "global" | "event_type";

export default function WorkflowList() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [gated, setGated] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [reminderSummary, setReminderSummary] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("global");
  const [eventTypeId, setEventTypeId] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    setGated(false);
    try {
      const { workflows: wfs } = await api.scheduling.listWorkflows(owner);
      setWorkflows(wfs ?? []);
      setPhase("ready");
    } catch (err) {
      const d = decodeError(err);
      if (
        d.kind === "error" &&
        (d.code === "FORBIDDEN" || d.code === "NOT_ALLOWED")
      ) {
        setGated(true);
        setWorkflows([]);
        setPhase("ready");
      } else {
        setPhase("error");
      }
    }
    // Best-effort context: event types (scope picker) + reminder summary.
    api.scheduling
      .listEventTypes(owner)
      .then((res) => {
        const list = res.eventTypes ?? [];
        setEventTypes(list);
        setEventTypeId((cur) => cur || list[0]?.id || "");
      })
      .catch(() => undefined);
    api.scheduling
      .getNotificationPreferences(owner)
      .then((res) =>
        setReminderSummary(
          summarizeReminders(
            readReminders((res.prefs ?? {}) as Record<string, unknown>),
          ),
        ),
      )
      .catch(() => undefined);
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventTypeName = useCallback(
    (id: string | null) =>
      id
        ? (eventTypes.find((e) => e.id === id)?.name ?? "An event type")
        : null,
    [eventTypes],
  );

  const visible = useMemo(() => {
    if (scope === "global") return workflows.filter((w) => !w.event_type_id);
    return workflows.filter((w) => w.event_type_id === eventTypeId);
  }, [workflows, scope, eventTypeId]);

  const newHref = () =>
    scope === "event_type" && eventTypeId
      ? `/app/scheduling/workflows/new?eventType=${eventTypeId}`
      : "/app/scheduling/workflows/new";

  const toggleActive = async (w: Workflow) => {
    if (gated) return;
    const next = !w.is_active;
    setBusyId(w.id);
    setWorkflows((list) =>
      list.map((x) => (x.id === w.id ? { ...x, is_active: next } : x)),
    );
    try {
      await api.scheduling.updateWorkflow(w.id, { is_active: next }, owner);
    } catch (err) {
      setWorkflows((list) =>
        list.map((x) => (x.id === w.id ? { ...x, is_active: !next } : x)),
      );
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Overline pillar={pillar} className="mb-1.5">
            Reminders &amp; automations
          </Overline>
          <h1 className="text-xl font-bold text-app-text">Workflows</h1>
          <p className="mt-0.5 text-sm text-app-text-secondary">
            Messages that run themselves when bookings happen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(newHref())}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
          New
        </button>
      </header>

      <div className="mb-4">
        <UnderlineTabs
          pillar={pillar}
          value={scope}
          onChange={setScope}
          tabs={[
            { id: "global", label: "Global" },
            { id: "event_type", label: "This event type" },
          ]}
        />
      </div>

      {scope === "event_type" && eventTypes.length > 0 && (
        <div className="mb-4">
          <select
            value={eventTypeId}
            onChange={(e) => setEventTypeId(e.target.value)}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-[14px] font-medium text-app-text focus:border-app-personal focus:outline-none focus:ring-2 focus:ring-app-personal/30"
            aria-label="Event type"
          >
            {eventTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Reminders — pinned, links to H1. */}
      {scope === "global" && (
        <section className="mb-5">
          <Overline className="mb-2">Reminders</Overline>
          <Card>
            <Row
              href="/app/scheduling/reminders"
              leading={<IconTile icon={Bell} pillar={pillar} />}
              label="Default reminders"
              sub={reminderSummary ?? "Pick the lead-times for every event."}
              chevron
            />
          </Card>
        </section>
      )}

      <section>
        <Overline className="mb-2">Your workflows</Overline>

        {phase === "loading" && (
          <Card>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3.5 py-3.5">
                <ShimmerBlock className="h-[34px] w-[34px] rounded-[9px]" />
                <div className="flex-1 space-y-1.5">
                  <ShimmerBlock className="h-3 w-1/2 rounded" />
                  <ShimmerBlock className="h-2.5 w-2/5 rounded" />
                </div>
                <ShimmerBlock className="h-[28px] w-[46px] rounded-full" />
              </div>
            ))}
          </Card>
        )}

        {phase === "error" && (
          <WorkflowsErrorCard onRetry={() => void load()} />
        )}

        {phase === "ready" && gated && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-app-warning-light bg-app-warning-bg px-3 py-2.5">
            <Lock className="h-4 w-4 shrink-0 text-app-warning" aria-hidden />
            <span className="text-[12px] font-semibold text-app-warning">
              Only admins can edit these workflows.
            </span>
          </div>
        )}

        {phase === "ready" && !gated && visible.length === 0 && (
          <EmptyWorkflows
            pillar={pillar}
            onAdd={() => router.push(newHref())}
          />
        )}

        {phase === "ready" && visible.length > 0 && (
          <Card>
            {visible.map((w, i) => (
              <WorkflowRow
                key={w.id}
                workflow={w}
                pillar={pillar}
                gated={gated}
                busy={busyId === w.id}
                last={i === visible.length - 1}
                scopedTo={
                  scope === "global" ? null : eventTypeName(w.event_type_id)
                }
                onOpen={() => router.push(`/app/scheduling/workflows/${w.id}`)}
                onToggle={() => toggleActive(w)}
              />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

/**
 * H2 Frame 4 — error card: bordered white card, cloud-off icon halo,
 * correct headline, filled-sky "Try again" button (no icon, no border).
 */
function WorkflowsErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-[22px] text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-secondary">
        <CloudOff className="h-[23px] w-[23px]" aria-hidden />
      </span>
      <p className="text-[13.5px] font-bold text-app-text">
        Couldn&rsquo;t load workflows
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="h-[38px] rounded-[10px] bg-app-info px-[18px] text-[12.5px] font-bold text-white transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

function WorkflowRow({
  workflow: w,
  pillar,
  gated,
  busy,
  last,
  scopedTo,
  onOpen,
  onToggle,
}: {
  workflow: Workflow;
  pillar: ReturnType<typeof pillarForOwner>;
  gated: boolean;
  busy: boolean;
  last: boolean;
  scopedTo: string | null;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const trig = triggerMeta(w.trigger);
  const act = actionMeta(w.action);
  const ActionIcon = act.icon;
  return (
    <div
      className={clsx(
        "flex items-center gap-3 px-3.5 py-3",
        gated && "opacity-60",
        !last && "border-b border-app-border-subtle",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <IconTile icon={trig.icon} muted />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-app-text">
            {w.name || triggerSummary(w)}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-app-text-secondary">
            <ActionIcon
              className="h-3 w-3 shrink-0 text-app-text-muted"
              aria-hidden
            />
            <span className="truncate">
              {actionSummary(w.action)}
              {w.message_template ? " · custom message" : ""}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Chip tone={w.is_active ? "success" : "neutral"}>
              {w.is_active ? "Active" : "Paused"}
            </Chip>
            {scopedTo && <Chip tone={pillar}>{scopedTo}</Chip>}
          </div>
        </div>
      </button>
      {!gated && (
        <Toggle
          on={w.is_active}
          pillar={pillar}
          disabled={busy}
          onChange={onToggle}
          label={`${w.name || "Workflow"} active`}
        />
      )}
    </div>
  );
}

function EmptyWorkflows({
  pillar,
  onAdd,
}: {
  pillar: ReturnType<typeof pillarForOwner>;
  onAdd: () => void;
}) {
  const tk = pillarTokens(pillar);
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-app-border bg-app-surface px-6 py-12 text-center">
      <span
        className={clsx(
          "flex h-14 w-14 items-center justify-center rounded-full",
          tk.bgSoft,
          tk.text,
        )}
      >
        <WorkflowIcon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="text-[15px] font-bold text-app-text">No follow-ups yet</h2>
      <p className="max-w-xs text-[12.5px] leading-5 text-app-text-secondary">
        Reminders are handled. Add a thank-you or a review request to run
        automatically.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-app-border-strong bg-app-surface px-4 py-2 text-[13px] font-bold text-app-text transition hover:bg-app-hover"
      >
        <Plus className={clsx("h-3.5 w-3.5", tk.text)} aria-hidden />
        Add a follow-up
      </button>
    </div>
  );
}
