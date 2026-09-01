"use client";

// W17 · H13 — Insights Period & Filter sheet. A LOCAL bottom sheet (no global
// route) that edits the shared InsightsFilters: the reporting window (presets
// or a custom range), the timezone reports render in, and an optional
// event-type facet. "Apply" writes the draft back to the URL via the caller;
// the window drives every report's `days` / `from..to` params.

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Clock, Filter, RotateCcw } from "lucide-react";
import * as api from "@pantopus/api";
import type { EventType, SchedulingOwnerRef } from "@pantopus/types";
import BottomSheet from "@/components/ui/BottomSheet";
import TimezoneSelector, {
  zoneLabel,
} from "@/components/scheduling/TimezoneSelector";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import {
  PRESETS,
  defaultFilters,
  isCustomIncomplete,
  type InsightsFilters,
  type InsightsPreset,
} from "./filters";

function Label({ children }: { children: string }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-text-muted">
      {children}
    </p>
  );
}

export default function PeriodFilterSheet({
  open,
  onClose,
  value,
  onApply,
  owner,
  pillar,
}: {
  open: boolean;
  onClose: () => void;
  value: InsightsFilters;
  onApply: (next: InsightsFilters) => void;
  owner: SchedulingOwnerRef;
  pillar: Pillar;
}) {
  const tk = pillarTokens(pillar);
  const [draft, setDraft] = useState<InsightsFilters>(value);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [tzOpen, setTzOpen] = useState(false);

  // Re-seed the draft each time the sheet opens.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  // Lazy-load event types for the facet the first time the sheet opens.
  useEffect(() => {
    if (!open || eventTypes.length) return;
    let alive = true;
    api.scheduling
      .listEventTypes(owner)
      .then((res) => {
        if (alive) setEventTypes(res.eventTypes ?? []);
      })
      .catch(() => {
        /* facet just stays empty */
      });
    return () => {
      alive = false;
    };
  }, [open, owner, eventTypes.length]);

  const setPreset = (preset: InsightsPreset) =>
    setDraft((d) => ({ ...d, preset }));

  const apply = () => {
    if (isCustomIncomplete(draft)) return;
    onApply(draft);
    onClose();
  };

  const reset = () => setDraft(defaultFilters(value.tz));

  const footer = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-text-strong hover:bg-app-hover"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Reset
      </button>
      <button
        type="button"
        onClick={apply}
        disabled={isCustomIncomplete(draft)}
        className={clsx(
          "inline-flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
          tk.bg,
          tk.textOn,
        )}
      >
        Apply
      </button>
    </div>
  );

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Period & filters"
        footer={footer}
      >
        <div className="space-y-5">
          {/* Preset window */}
          <div>
            <Label>Reporting window</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = draft.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    aria-pressed={on}
                    className={clsx(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                      on
                        ? clsx(tk.bgSoft, tk.text, tk.border)
                        : "border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover",
                    )}
                  >
                    {on && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-current"
                        aria-hidden
                      />
                    )}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom range */}
          {draft.preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Label>From</Label>
                <input
                  type="date"
                  value={draft.from ?? ""}
                  max={draft.to ?? undefined}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, from: e.target.value || null }))
                  }
                  className="w-full rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2.5 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </label>
              <label className="block">
                <Label>To</Label>
                <input
                  type="date"
                  value={draft.to ?? ""}
                  min={draft.from ?? undefined}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, to: e.target.value || null }))
                  }
                  className="w-full rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2.5 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </label>
            </div>
          )}

          {/* Timezone */}
          <div>
            <Label>Time zone</Label>
            <button
              type="button"
              onClick={() => setTzOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-lg border border-app-border bg-app-surface px-3 py-2.5 text-left hover:bg-app-hover"
            >
              <Clock
                className="h-4 w-4 shrink-0 text-app-text-secondary"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-app-text">
                {zoneLabel(draft.tz)}
              </span>
              <span className="text-xs font-semibold text-app-text-muted">
                Change
              </span>
            </button>
          </div>

          {/* Event-type facet */}
          <div>
            <Label>Event type</Label>
            <div className="relative">
              <Filter
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted"
                aria-hidden
              />
              <select
                value={draft.eventTypeId ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    eventTypeId: e.target.value || null,
                  }))
                }
                className="w-full appearance-none rounded-lg border border-app-border bg-app-surface py-2.5 pl-9 pr-8 text-sm font-medium text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              >
                <option value="">All event types</option>
                {eventTypes.map((et) => (
                  <option key={et.id} value={et.id}>
                    {et.name}
                  </option>
                ))}
              </select>
              {draft.eventTypeId && (
                <Check
                  className={clsx(
                    "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2",
                    tk.text,
                  )}
                  aria-hidden
                />
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-app-text-muted">
              Applies to the dashboard and per-event-type report.
            </p>
          </div>
        </div>
      </BottomSheet>

      <TimezoneSelector
        open={tzOpen}
        onClose={() => setTzOpen(false)}
        value={draft.tz}
        pillar={pillar}
        onSelect={(tz) => setDraft((d) => ({ ...d, tz }))}
      />
    </>
  );
}
