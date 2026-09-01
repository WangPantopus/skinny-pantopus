"use client";

// B5 Weekly hours editor + B6 Date overrides + B7 Limits (thin), as tabs on one
// schedule. Weekly hours save name+timezone (PUT schedule) and the whole rule
// set (PUT rules, whole-set). Overrides persist on each change (PUT overrides,
// whole-set) optimistically. Limits are read-only here — they live on the event
// type (W2). Availability is always personal; tz renders the schedule zone.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import type {
  AvailabilitySchedule,
  AvailabilityRule,
  AvailabilityOverride,
} from "@pantopus/types";
import {
  CalendarClock,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Globe,
  Layers,
  Lock,
  Sliders,
  TriangleAlert,
  User,
  WandSparkles,
} from "lucide-react";
import clsx from "clsx";
import ErrorState from "@/components/ui/ErrorState";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import { toast } from "@/components/ui/toast-store";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { decodeError } from "@/components/scheduling/decodeError";
import TimezoneSelector, {
  detectTimezone,
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import {
  Card,
  FieldLabel,
  ToggleRow,
} from "@/components/scheduling/availability/primitives";
import WeeklyHoursGrid from "@/components/scheduling/availability/WeeklyHoursGrid";
import DateOverrideEditor from "@/components/scheduling/availability/DateOverrideEditor";
import BookingLimitsForm from "@/components/scheduling/availability/BookingLimitsForm";
import {
  rulesToDays,
  daysToRules,
  seedDefaultDays,
  hasAnyHours,
  rowsForSchedule,
  type DayModel,
} from "@/components/scheduling/availability/serialize";

type Tab = "hours" | "overrides" | "limits";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "hours", label: "Weekly hours" },
  { key: "overrides", label: "Date overrides" },
  { key: "limits", label: "Limits & notice" },
];

function blocksValid(days: DayModel[]): boolean {
  return days.every(
    (d) => !d.on || d.blocks.every((b) => b.start && b.end && b.end > b.start),
  );
}

export default function AvailabilityEditorPage() {
  const router = useRouter();
  const owner = useSchedulingOwner();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [days, setDays] = useState<DayModel[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  // isUnset: true when the schedule has never had any rules set (fresh entry from
  // Home/Business composer). Drives the CompositionGapCard + EmptyHero branch per
  // the design's FrameEmpty. It flips to false the first time the user saves hours.
  const [isUnset, setIsUnset] = useState(false);

  const [tab, setTab] = useState<Tab>("hours");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [lockTz, setLockTz] = useState(false);
  const [tzPicker, setTzPicker] = useState(false);

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      router.push("/login");
      return;
    }
    try {
      const bundle = await api.scheduling.getAvailability(owner);
      const schedule = (bundle.schedules || []).find(
        (s: AvailabilitySchedule) => s.id === id,
      );
      if (!schedule) {
        setNotFound(true);
        return;
      }
      const scopedRules = rowsForSchedule<AvailabilityRule>(
        bundle.rules || [],
        id,
      );
      setName(schedule.name);
      setTimezone(schedule.timezone || detectTimezone());
      const dayModels = rulesToDays(scopedRules);
      setDays(dayModels);
      // If no rules were ever set the schedule is "unset" — show CompositionGapCard
      // + EmptyHero rather than the normal name/timezone/grid layout.
      setIsUnset(dayModels.length === 0 && scopedRules.length === 0);
      setOverrides(
        rowsForSchedule<AvailabilityOverride>(bundle.overrides || [], id),
      );
      setError(null);
      setDirty(false);
    } catch (err) {
      setError(decodeError(err).message);
    }
  }, [owner, router, id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const markDirty = () => setDirty(true);

  const onDaysChange = (next: DayModel[]) => {
    setDays(next);
    markDirty();
  };

  const useQuickDefault = () => {
    setDays(seedDefaultDays());
    setIsUnset(false);
    markDirty();
  };

  const saveHours = async () => {
    if (!blocksValid(days)) {
      toast.error("Check your time blocks — each end must be after its start.");
      return;
    }
    setSaving(true);
    try {
      await api.scheduling.updateSchedule(
        id,
        { name: name.trim() || "Working hours", timezone },
        owner,
      );
      await api.scheduling.updateRules(id, daysToRules(days), owner);
      setDirty(false);
      setIsUnset(false);
      toast.success("Schedule saved.");
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  // Overrides persist immediately (whole-set), optimistic with revert on error.
  const persistOverrides = async (next: AvailabilityOverride[]) => {
    const prev = overrides;
    setOverrides(next);
    setOverridesSaving(true);
    try {
      await api.scheduling.updateOverrides(id, next, owner);
    } catch (err) {
      setOverrides(prev);
      toast.error(decodeError(err).message);
    } finally {
      setOverridesSaving(false);
    }
  };

  const noHours = useMemo(() => !hasAnyHours(days), [days]);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        <ShimmerBlock className="h-10 w-44 rounded-lg" />
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
        <ShimmerBlock className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl">
        <BackLink onClick={() => router.push("/app/scheduling/availability")} />
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-14 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-surface-sunken text-app-text-muted">
            <CalendarOff className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-app-text">
            Schedule not found
          </h2>
          <p className="mt-1 text-sm text-app-text-secondary">
            It may have been deleted. Head back to your schedules.
          </p>
          <button
            type="button"
            onClick={() => router.push("/app/scheduling/availability")}
            className="mt-5 rounded-xl bg-app-personal px-5 py-2.5 text-sm font-bold text-white"
          >
            Back to availability
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <BackLink onClick={() => router.push("/app/scheduling/availability")} />
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => load()} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl pb-24">
      <BackLink onClick={() => router.push("/app/scheduling/availability")} />

      {/* Page title — "Set hours" when unset (FrameEmpty), "Edit schedule" otherwise */}
      <h1 className="mt-2 text-2xl font-bold text-app-text">
        {isUnset ? "Set hours" : "Edit schedule"}
      </h1>

      {/* HeaderPill — personal identity chip shown below the top bar in every frame */}
      <div className="mt-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-app-personal-bg px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-app-personal">
          <User className="h-3 w-3" aria-hidden />
          Personal
        </span>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex gap-1 border-b border-app-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
              tab === t.key
                ? "border-app-personal text-app-personal"
                : "border-transparent text-app-text-secondary hover:text-app-text",
            )}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "hours" && (
          <div className="space-y-3">
            {/* FrameEmpty — unset / composition-gap state */}
            {isUnset ? (
              <>
                {/* CompositionGapCard: explains that home/business build on these hours */}
                <div className="flex items-start gap-3 rounded-2xl border border-app-personal/30 bg-app-personal-bg p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-personal/10 text-app-personal">
                    <Layers className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-app-text">
                      Start with your hours
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-app-text-secondary">
                      Your family and business pages build on these hours, so
                      set them first.
                    </p>
                  </div>
                </div>

                {/* EmptyHero card */}
                <Card>
                  <div className="flex flex-col items-center px-4 py-6 text-center">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-app-personal-bg text-app-personal">
                      <CalendarClock className="h-7 w-7" strokeWidth={1.9} aria-hidden />
                    </span>
                    <h2 className="text-[16px] font-bold tracking-tight text-app-text">
                      Set your hours
                    </h2>
                    <p className="mt-1.5 max-w-[14rem] text-[12.5px] leading-relaxed text-app-text-secondary">
                      Tell people the days and times you&apos;re open to
                      bookings. You can fine-tune any day after.
                    </p>
                    <button
                      type="button"
                      onClick={useQuickDefault}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-app-personal/30 bg-app-personal-bg py-2.5 text-[13px] font-bold text-primary-700"
                    >
                      <WandSparkles className="h-4 w-4" aria-hidden /> Use 9–5,
                      Mon–Fri
                    </button>
                  </div>
                </Card>

                {/* LinksCard still shown in empty state */}
                <Card>
                  <button
                    type="button"
                    onClick={() => setTab("overrides")}
                    className="flex w-full items-center gap-3 border-b border-app-border py-2.5 text-left"
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                      <CalendarOff className="h-[15px] w-[15px]" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-app-text">
                        Date overrides &amp; holidays
                      </span>
                      <span className="text-[11px] text-app-text-secondary">
                        None set
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-app-text-muted"
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("limits")}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                      <Sliders className="h-[15px] w-[15px]" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-app-text">
                        Booking limits &amp; notice rules
                      </span>
                      <span className="text-[11px] text-app-text-secondary">
                        Defaults
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-app-text-muted"
                      aria-hidden
                    />
                  </button>
                </Card>
              </>
            ) : (
              /* Normal hours state (FrameDefault / FrameMultiBlock / FrameWarning) */
              <>
                <Card overline="Schedule">
                  <FieldLabel>Name</FieldLabel>
                  <input
                    type="text"
                    value={name}
                    aria-label="Schedule name"
                    onChange={(e) => {
                      setName(e.target.value);
                      markDirty();
                    }}
                    placeholder="Working hours"
                    className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2.5 text-sm text-app-text outline-none focus:border-app-personal"
                  />
                </Card>

                <Card overline="Timezone">
                  <FieldLabel>Time zone</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setTzPicker(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg border border-app-border bg-app-surface px-3 py-2.5 text-left shadow-sm"
                  >
                    <Globe
                      className="h-4 w-4 shrink-0 text-app-text-secondary"
                      aria-hidden
                    />
                    <span className="flex-1 text-sm font-medium text-app-text">
                      {timezone ? zoneLabel(timezone) : "Select a time zone"}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-app-text-muted"
                      aria-hidden
                    />
                  </button>
                  <div className="mt-3">
                    <ToggleRow
                      icon={<Lock className="h-4 w-4" aria-hidden />}
                      label="Lock to my timezone"
                      sub="Keep these hours even when you travel"
                      on={lockTz}
                      onChange={setLockTz}
                      last
                    />
                  </div>
                </Card>

                {noHours && (
                  <div className="rounded-2xl border border-app-warning-light bg-app-warning-bg p-3.5">
                    <div className="flex items-start gap-2.5">
                      <TriangleAlert
                        className="mt-0.5 h-4 w-4 shrink-0 text-app-warning"
                        aria-hidden
                      />
                      <div className="flex-1">
                        <p className="text-[12.5px] font-bold text-app-text">
                          No hours set
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-app-text-secondary">
                          People can&apos;t book you until you add at least one
                          block.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={useQuickDefault}
                      className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-app-personal/30 bg-app-personal-bg py-2.5 text-[13px] font-bold text-primary-700"
                    >
                      <WandSparkles className="h-4 w-4" aria-hidden /> Use 9–5,
                      Mon–Fri
                    </button>
                  </div>
                )}

                <Card overline="Weekly hours">
                  <WeeklyHoursGrid
                    days={days}
                    onChange={onDaysChange}
                    disabled={saving}
                  />
                </Card>

                <Card>
                  <button
                    type="button"
                    onClick={() => setTab("overrides")}
                    className="flex w-full items-center gap-3 border-b border-app-border py-2.5 text-left"
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                      <CalendarOff className="h-[15px] w-[15px]" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-app-text">
                        Date overrides &amp; holidays
                      </span>
                      <span className="text-[11px] text-app-text-secondary">
                        {overrides.length
                          ? `${overrides.length} set`
                          : "None set"}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-app-text-muted"
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("limits")}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-secondary">
                      <Sliders className="h-[15px] w-[15px]" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-app-text">
                        Booking limits &amp; notice rules
                      </span>
                      <span className="text-[11px] text-app-text-secondary">
                        Per event type
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-app-text-muted"
                      aria-hidden
                    />
                  </button>
                </Card>
              </>
            )}
          </div>
        )}

        {tab === "overrides" && (
          <DateOverrideEditor
            overrides={overrides}
            onChange={persistOverrides}
            saving={overridesSaving}
          />
        )}

        {tab === "limits" && (
          <BookingLimitsForm
            onDone={async () => {
              // NOTE: The backend has no schedule-level limits endpoint (limits live on
              // event types). This saves to the event-type layer when that API is wired.
              // For now the interaction is local-state only, matching the design's done CTA.
              toast.success("Limits updated.");
            }}
          />
        )}
      </div>

      {/* Sticky save bar — hours tab (not in isUnset state) */}
      {tab === "hours" && !isUnset && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={saveHours}
            disabled={saving || !dirty}
            className="w-full rounded-xl bg-app-personal py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : dirty ? "Save schedule" : "Saved"}
          </button>
        </div>
      )}

      <TimezoneSelector
        open={tzPicker}
        onClose={() => setTzPicker(false)}
        value={timezone}
        onSelect={(tz) => {
          setTimezone(tz);
          markDirty();
        }}
      />
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-medium text-app-text-secondary hover:text-app-text"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden /> Availability
    </button>
  );
}
