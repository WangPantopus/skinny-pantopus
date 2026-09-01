"use client";

// W2 — Event Types · B1 Event Type / Service list (+ H-style empty / all-hidden
// states). Personal → "Event types"; business → "Services". Active / Hidden
// filter is client-side on is_active. Row actions: open, toggle active, copy
// booking link, duplicate, share, delete (→ 409 HAS_UPCOMING_BOOKINGS offers
// deactivate instead). All calls carry the SchedulingOwner context.
// B1 FRAME 6: reorder mode — grip rows, HTML5 drag, PUT {sort_order} per
// changed row. B1 FRAME 7: FORBIDDEN list → read-only catalog (lock banner,
// disabled New / toggles / overflow), mirroring iOS/Android.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowRight,
  CalendarPlus,
  Clock,
  EyeOff,
  Lock,
  Move,
  Plus,
} from "lucide-react";
import * as api from "@pantopus/api";
import type { EventType } from "@pantopus/types";
import { APP_WEB_URL, buildBookingEventPath } from "@pantopus/utils";
import { webFeatureFlags } from "@/lib/featureFlags";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { PRIMARY_BLUE, pillarForOwner } from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import EventTypeCard, {
  metaLine,
} from "@/components/scheduling/event-types/EventTypeCard";
import {
  PillarPill,
  SectionOverline,
  Toggle,
} from "@/components/scheduling/event-types/fields";
import {
  eventTypeToForm,
  formToInput,
  slugify,
  suffixSlug,
} from "@/components/scheduling/event-types/eventTypeFormModel";

const NEW_PATH = "/app/scheduling/event-types/new";

export default function EventTypesPage() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const paid = webFeatureFlags.schedulingPaid;
  const isBiz = pillar === "business";

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [filter, setFilter] = useState<"active" | "hidden">("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageSlug, setPageSlug] = useState<string | null>(null);
  // FRAME 7 — permission-gated read-only catalog (FORBIDDEN on list).
  const [canEdit, setCanEdit] = useState(true);
  // FRAME 6 — reorder mode.
  const [reordering, setReordering] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const listRef = useRef<EventType[]>([]);
  useEffect(() => {
    listRef.current = eventTypes;
  }, [eventTypes]);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    setCanEdit(true);
    api.scheduling
      .listEventTypes(owner)
      .then((res) => {
        if (!alive) return;
        setEventTypes(res.eventTypes ?? []);
        setPhase("ready");
      })
      .catch((err) => {
        if (!alive) return;
        const d = decodeError(err);
        // Same permission signal the automations surface uses: a FORBIDDEN
        // list is the read-only state, not an error dead end.
        if (
          d.kind === "error" &&
          (d.code === "FORBIDDEN" || d.code === "NOT_ALLOWED")
        ) {
          setCanEdit(false);
          setEventTypes([]);
          setPhase("ready");
        } else {
          setPhase("error");
        }
      });
    // Best-effort: the booking-page slug lets us build per-event copy links.
    api.scheduling
      .getBookingPage(owner)
      .then((res) => {
        if (alive) setPageSlug(res.page?.slug ?? null);
      })
      .catch(() => {
        /* no page yet — copy link disabled */
      });
    // FRAME 7 second tier: a home member with calendar.view but not calendar.edit can LIST
    // the catalog (the 403 branch above never fires) yet every mutation would 403. Resolve
    // the edit permission up front so the catalog renders read-only instead of erroring on
    // first touch. Personal/business owners are edit-capable whenever the list loads.
    if (owner.ownerType === "home" && owner.homeId) {
      import("@pantopus/api")
        .then(({ get }) => get(`/api/homes/${owner.homeId}/me`))
        .then((me) => {
          if (!alive) return;
          const perms = (me as { permissions?: string[] })?.permissions ?? [];
          if (!perms.includes("calendar.edit")) setCanEdit(false);
        })
        .catch(() => {
          /* permission probe is best-effort; mutations still 403 server-side */
        });
    }
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => load(), [load]);

  const reload = () => load();

  const active = eventTypes.filter((e) => e.is_active);
  const hidden = eventTypes.filter((e) => !e.is_active);
  const shown = filter === "active" ? active : hidden;

  // ── Row actions ───────────────────────────────────────────────
  const toggleActive = async (et: EventType) => {
    const next = !et.is_active;
    setBusyId(et.id);
    setEventTypes((list) =>
      list.map((x) => (x.id === et.id ? { ...x, is_active: next } : x)),
    );
    try {
      await api.scheduling.updateEventType(et.id, { is_active: next }, owner);
    } catch (err) {
      setEventTypes((list) =>
        list.map((x) => (x.id === et.id ? { ...x, is_active: !next } : x)),
      );
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const copyLink = async (et: EventType) => {
    if (!pageSlug) {
      toast.info("Set up your booking page first to share links.");
      return;
    }
    const url = `${APP_WEB_URL}${buildBookingEventPath(pageSlug, et.slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Booking link copied.");
    } catch {
      toast.info(url);
    }
  };

  const share = async (et: EventType) => {
    if (!pageSlug) {
      toast.info("Set up your booking page first to share links.");
      return;
    }
    const url = `${APP_WEB_URL}${buildBookingEventPath(pageSlug, et.slug)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: et.name, url });
      } catch {
        /* user dismissed */
      }
    } else {
      void copyLink(et);
    }
  };

  const duplicate = async (et: EventType) => {
    setBusyId(et.id);
    try {
      const base = formToInput(
        { ...eventTypeToForm(et), name: `${et.name} (copy)` },
        { includePricing: paid },
      );
      let slug = slugify(`${et.name}-copy`);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await api.scheduling.createEventType({ ...base, slug }, owner);
          break;
        } catch (err) {
          const d = decodeError(err);
          if (d.kind === "error" && d.code === "SLUG_TAKEN" && attempt < 4) {
            slug = suffixSlug(slug, attempt + 2);
            continue;
          }
          throw err;
        }
      }
      toast.success("Event type duplicated.");
      reload();
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (et: EventType) => {
    const ok = await confirmStore.open({
      title: `Delete "${et.name}"?`,
      description:
        "This removes the event type. Past bookings are kept. This can't be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setBusyId(et.id);
    try {
      await api.scheduling.deleteEventType(et.id, owner);
      setEventTypes((list) => list.filter((x) => x.id !== et.id));
      toast.success("Event type deleted.");
    } catch (err) {
      const d = decodeError(err);
      if (d.kind === "error" && d.code === "HAS_UPCOMING_BOOKINGS") {
        const deactivate = await confirmStore.open({
          title: "This has upcoming bookings",
          description:
            "You can't delete an event type with pending or confirmed bookings. Hide it instead so no new bookings come in?",
          confirmLabel: "Hide it",
          cancelLabel: "Keep it",
        });
        if (deactivate) await toggleActiveTo(et, false);
      } else {
        toast.error(d.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleActiveTo = async (et: EventType, next: boolean) => {
    setEventTypes((list) =>
      list.map((x) => (x.id === et.id ? { ...x, is_active: next } : x)),
    );
    try {
      await api.scheduling.updateEventType(et.id, { is_active: next }, owner);
      toast.success(next ? "Event type shown." : "Event type hidden.");
    } catch (err) {
      setEventTypes((list) =>
        list.map((x) => (x.id === et.id ? { ...x, is_active: !next } : x)),
      );
      toast.error(decodeError(err).message);
    }
  };

  // ── Reorder mode (FRAME 6) ────────────────────────────────────
  // Live-preview: dragging a row over another moves it in local state; each
  // completed drag persists every row whose position no longer matches its
  // stored sort_order via PUT /event-types/:id {sort_order} (the list
  // endpoint already orders by sort_order).
  const moveDragged = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setEventTypes((list) => {
      const from = list.findIndex((x) => x.id === dragId);
      const to = list.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0 || from === to) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const persistOrder = async () => {
    const list = listRef.current;
    const changed = list
      .map((et, index) => ({ et, index }))
      .filter(({ et, index }) => et.sort_order !== index);
    if (changed.length === 0) return;
    // Optimistic: stamp positions locally, then persist only the changed rows.
    setEventTypes((cur) => cur.map((et, i) => ({ ...et, sort_order: i })));
    const results = await Promise.allSettled(
      changed.map(({ et, index }) =>
        api.scheduling.updateEventType(et.id, { sort_order: index }, owner),
      ),
    );
    if (results.some((r) => r.status === "rejected")) {
      toast.error("Couldn't save the new order.");
      reload();
    }
  };

  const handleDragEnd = () => {
    setDragId(null);
    void persistOrder();
  };

  const doneReordering = () => {
    setDragId(null);
    setReordering(false);
    void persistOrder();
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      <header className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2">
              <PillarPill pillar={pillar} />
            </div>
            <h1 className="text-xl font-bold text-app-text">
              {isBiz ? "Services" : "Event types"}
            </h1>
            <p className="mt-0.5 text-sm text-app-text-secondary">
              {isBiz
                ? "Bookable services people can request."
                : "Things people can book with you."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && !reordering && phase === "ready" && shown.length > 1 && (
              <button
                type="button"
                onClick={() => setReordering(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm font-semibold text-primary-700 shadow-sm transition hover:bg-app-hover"
              >
                <Move className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                Reorder
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(NEW_PATH)}
              disabled={!canEdit || reordering}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
              New
            </button>
          </div>
        </div>

        {/* FRAME 6 — reorder hint bar */}
        {reordering && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2">
            <Move
              className="h-[15px] w-[15px] shrink-0 text-primary-700"
              aria-hidden
            />
            <span className="flex-1 text-[11.5px] font-semibold text-primary-700">
              Drag to set the order people see
            </span>
            <button
              type="button"
              onClick={doneReordering}
              className="text-xs font-bold text-primary-700"
            >
              Done
            </button>
          </div>
        )}

        {/* FRAME 7 — permission-gated read-only banner */}
        {!canEdit && phase === "ready" && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-app-border bg-app-surface-sunken px-3 py-2.5">
            <Lock
              className="h-[15px] w-[15px] shrink-0 text-app-text-muted"
              aria-hidden
            />
            <span className="text-[11.5px] font-medium text-app-text-secondary">
              Only owners can edit this catalog.
            </span>
          </div>
        )}

        {phase === "ready" && eventTypes.length > 0 && (
          <div className="mt-4 flex gap-1 rounded-[10px] bg-app-surface-sunken p-1">
            {(["active", "hidden"] as const).map((f) => {
              const on = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={clsx(
                    "h-8 flex-1 rounded-md text-xs capitalize transition",
                    on
                      ? "bg-app-surface font-bold text-primary-700 shadow-sm"
                      : "font-semibold text-app-text-secondary hover:text-app-text",
                  )}
                >
                  {f}
                  {f === "active" && active.length > 0 && ` (${active.length})`}
                  {f === "hidden" && hidden.length > 0 && ` (${hidden.length})`}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <ShimmerBlock key={i} className="h-[58px] rounded-[14px]" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <ErrorState
          message="We couldn't load your event types."
          onRetry={reload}
        />
      )}

      {phase === "ready" && eventTypes.length === 0 && (
        <EmptyState
          pillarBusiness={isBiz}
          onCreate={() => router.push(NEW_PATH)}
          onTemplate={(d) => router.push(`${NEW_PATH}?duration=${d}`)}
        />
      )}

      {phase === "ready" && eventTypes.length > 0 && shown.length === 0 && (
        <AllHidden
          filter={filter}
          onViewHidden={() => setFilter("hidden")}
        />
      )}

      {phase === "ready" && shown.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionOverline pillar={pillar}>
            {isBiz ? "Bookable services" : "Your event types"}
          </SectionOverline>
          {shown.map((et) => (
            <div
              key={et.id}
              draggable={reordering}
              onDragStart={reordering ? () => setDragId(et.id) : undefined}
              onDragOver={
                reordering
                  ? (e) => {
                      e.preventDefault();
                      moveDragged(et.id);
                    }
                  : undefined
              }
              onDrop={reordering ? (e) => e.preventDefault() : undefined}
              onDragEnd={reordering ? handleDragEnd : undefined}
            >
              <EventTypeCard
                eventType={et}
                showPrice={paid}
                busy={busyId === et.id}
                disabled={!canEdit}
                reorder={reordering}
                lifted={reordering && dragId === et.id}
                dimmed={reordering && dragId !== null && dragId !== et.id}
                onOpen={() =>
                  router.push(`/app/scheduling/event-types/${et.id}`)
                }
                onToggleActive={() => toggleActive(et)}
                onCopyLink={() => copyLink(et)}
                onDuplicate={() => duplicate(et)}
                onShare={() => share(et)}
                onDelete={() => remove(et)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  pillarBusiness,
  onCreate,
  onTemplate,
}: {
  pillarBusiness: boolean;
  onCreate: () => void;
  onTemplate: (duration: number) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <CalendarPlus className="h-9 w-9" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-base font-semibold text-app-text">
        You don&apos;t have any {pillarBusiness ? "services" : "event types"}{" "}
        yet
      </h2>
      <p className="mb-5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
        An event type is something people can book — a call, a meeting, a visit.
        Start from a template or build your own.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mb-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
        Create your first {pillarBusiness ? "service" : "event type"}
      </button>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-app-text-muted">
        Start from a template
      </p>
      <div className="flex gap-2">
        {[15, 30, 60].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onTemplate(d)}
            className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3.5 py-2 text-xs font-semibold text-app-text-secondary transition hover:border-app-border-strong"
          >
            <Clock className="h-3 w-3 text-primary-600" aria-hidden />
            {d} min
          </button>
        ))}
      </div>
    </div>
  );
}

function AllHidden({
  filter,
  onViewHidden,
}: {
  filter: "active" | "hidden";
  onViewHidden: () => void;
}) {
  if (filter === "hidden") {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
          <EyeOff className="h-6 w-6" strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className="mb-1.5 text-[15px] font-semibold text-app-text">
          Nothing hidden
        </h2>
        <p className="max-w-xs text-sm text-app-text-secondary">
          Hidden event types show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
        <EyeOff className="h-6 w-6" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="mb-1.5 text-[15px] font-semibold text-app-text">
        Everything&apos;s hidden
      </h2>
      <p className="mb-5 max-w-xs text-sm text-app-text-secondary">
        Switch to Hidden to bring one back, or create a new event type.
      </p>
      <button
        type="button"
        onClick={onViewHidden}
        className="inline-flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-4 py-2 text-[13px] font-semibold text-primary-700 transition hover:bg-app-hover"
      >
        View hidden
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
