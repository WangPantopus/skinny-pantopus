"use client";

// B4 — Availability schedule list. The personal source of truth for when you're
// open to bookings. Lists named schedules (default pill + overflow actions),
// seeds a 9–5 Mon–Fri default from the calm empty state, and links each row into
// the weekly-hours editor. Availability is always personal (req.user) — the
// SchedulingOwner only selects the route base, never owner params.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@pantopus/api";
import { getAuthToken } from "@pantopus/api";
import type { AvailabilitySchedule, AvailabilityRule } from "@pantopus/types";
import { CalendarClock, Plus } from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import BottomSheet from "@/components/ui/BottomSheet";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { decodeError } from "@/components/scheduling/decodeError";
import { detectTimezone } from "@/components/scheduling/TimezoneSelector";
import ScheduleList, {
  ScheduleListSkeleton,
} from "@/components/scheduling/availability/ScheduleList";
import {
  daysToRules,
  seedDefaultDays,
  rowsForSchedule,
} from "@/components/scheduling/availability/serialize";

export default function AvailabilityListPage() {
  const router = useRouter();
  const owner = useSchedulingOwner();

  const [schedules, setSchedules] = useState<AvailabilitySchedule[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AvailabilitySchedule | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async () => {
    if (!getAuthToken()) {
      router.push("/login");
      return;
    }
    try {
      const bundle = await api.scheduling.getAvailability(owner);
      setSchedules(bundle.schedules || []);
      setRules(bundle.rules || []);
      setError(null);
    } catch (err) {
      setError(decodeError(err).message);
    }
  }, [owner, router]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const openEditor = useCallback(
    (id: string) => router.push(`/app/scheduling/availability/${id}`),
    [router],
  );

  // Empty-state seed: create a default schedule pre-filled with 9–5 Mon–Fri.
  const seedDefault = async () => {
    setBusy(true);
    try {
      const { schedule } = await api.scheduling.createSchedule(
        { name: "Working hours", timezone: detectTimezone(), is_default: true },
        owner,
      );
      await api.scheduling.updateRules(
        schedule.id,
        daysToRules(seedDefaultDays()),
        owner,
      );
      openEditor(schedule.id);
    } catch (err) {
      toast.error(decodeError(err).message);
      setBusy(false);
    }
  };

  const createBlank = async () => {
    setBusy(true);
    try {
      const { schedule } = await api.scheduling.createSchedule(
        {
          name: "New schedule",
          timezone: detectTimezone(),
          is_default: schedules.length === 0,
        },
        owner,
      );
      openEditor(schedule.id);
    } catch (err) {
      toast.error(decodeError(err).message);
      setBusy(false);
    }
  };

  const setDefault = async (s: AvailabilitySchedule) => {
    setBusy(true);
    try {
      await api.scheduling.updateSchedule(s.id, { is_default: true }, owner);
      await load();
      toast.success(`"${s.name}" is now your default schedule.`);
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (s: AvailabilitySchedule) => {
    setBusy(true);
    try {
      const { schedule } = await api.scheduling.createSchedule(
        { name: `${s.name} (copy)`, timezone: s.timezone, is_default: false },
        owner,
      );
      const sourceRules = rowsForSchedule(rules, s.id).map((r) => ({
        weekday: r.weekday,
        start_time: r.start_time,
        end_time: r.end_time,
      }));
      if (sourceRules.length) {
        await api.scheduling.updateRules(schedule.id, sourceRules, owner);
      }
      await load();
      toast.success(`Duplicated "${s.name}".`);
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: AvailabilitySchedule) => {
    const ok = await confirmStore.open({
      title: `Delete "${s.name}"?`,
      description:
        "This removes the schedule and its hours. This can't be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.scheduling.deleteSchedule(s.id, owner);
      await load();
      toast.success(`Deleted "${s.name}".`);
    } catch (err) {
      const decoded = decodeError(err);
      toast.error(
        decoded.message.includes("default")
          ? "Set another schedule as default before deleting this one."
          : decoded.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    try {
      await api.scheduling.updateSchedule(renameTarget.id, { name }, owner);
      setRenameTarget(null);
      await load();
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const isSingle = useMemo(() => schedules.length === 1, [schedules.length]);

  return (
    <div className="max-w-2xl">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-app-personal">
            Calendarly
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-app-text">
            Availability
          </h1>
          <p className="mt-1 max-w-md text-sm text-app-text-secondary">
            Times here are the source your home and business pages build from.
          </p>
        </div>
        {schedules.length > 0 && (
          <button
            type="button"
            onClick={createBlank}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-app-personal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden /> New schedule
          </button>
        )}
      </header>

      {loading ? (
        <ScheduleListSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-app-border bg-app-surface px-6 py-14 text-center">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-app-personal-bg text-app-personal">
            <CalendarClock className="h-8 w-8" strokeWidth={1.9} aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-app-text">
            You don&apos;t have a schedule yet
          </h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-app-text-secondary">
            Set the hours you&apos;re open to bookings. Your home and business
            pages build from this.
          </p>
          <button
            type="button"
            onClick={seedDefault}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-app-personal px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden /> Add
            working hours
          </button>
        </div>
      ) : (
        <>
          <ScheduleList
            schedules={schedules}
            rules={rules}
            onOpen={openEditor}
            onSetDefault={setDefault}
            onRename={(s) => {
              setRenameTarget(s);
              setRenameValue(s.name);
            }}
            onDuplicate={duplicate}
            onDelete={remove}
          />
          {isSingle && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-app-border bg-app-surface-raised px-3 py-2.5 text-[11.5px] leading-relaxed text-app-text-secondary">
              With one schedule, opening Availability takes you straight into
              the editor on other surfaces. Add another to keep separate sets of
              hours.
            </p>
          )}
        </>
      )}

      <BottomSheet
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename schedule"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-app-text-secondary hover:bg-app-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRename}
              disabled={busy || !renameValue.trim()}
              className="rounded-lg bg-app-personal px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        }
      >
        <label className="mb-1.5 block text-xs font-semibold text-app-text-strong">
          Name
        </label>
        <input
          type="text"
          autoFocus
          aria-label="Schedule name"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitRename()}
          className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:border-app-personal"
        />
      </BottomSheet>
    </div>
  );
}
