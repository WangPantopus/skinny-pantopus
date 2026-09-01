"use client";

// Weekly-hours grid for the first-run wizard (A2 step 3). Each day toggles on/off
// with an editable start–end range. Serializes to availability rules
// (weekday 0=Sunday, "HH:MM" times). Detailed availability tooling lives in the
// Availability section (W3); this is the quick first-run default.

import clsx from "clsx";
import type { Pillar } from "@/components/scheduling/pillarTokens";
import { Toggle } from "./ui";
import type { DayHours } from "./weeklyHours";

export { DEFAULT_WEEK, weekToRules } from "./weeklyHours";
export type { DayHours } from "./weeklyHours";

export default function WeeklyHoursEditor({
  value,
  onChange,
  pillar,
}: {
  value: DayHours[];
  onChange: (next: DayHours[]) => void;
  pillar: Pillar;
}) {
  const update = (weekday: number, patch: Partial<DayHours>) => {
    onChange(
      value.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)),
    );
  };

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-text-secondary">
        Weekly hours
      </p>
      <div className="divide-y divide-app-border overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
        {value.map((d) => (
          <div key={d.weekday} className="flex items-center gap-3 px-3.5 py-3">
            <Toggle
              on={d.enabled}
              pillar={pillar}
              label={d.label}
              onChange={(next) => update(d.weekday, { enabled: next })}
            />
            <span
              className={clsx(
                "w-20 text-[13.5px] font-semibold",
                d.enabled ? "text-app-text" : "text-app-text-muted",
              )}
            >
              {d.label}
            </span>
            {d.enabled ? (
              <div className="ml-auto flex items-center gap-1.5">
                <input
                  type="time"
                  value={d.start}
                  onChange={(e) => update(d.weekday, { start: e.target.value })}
                  className="rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-[12.5px] font-semibold tabular-nums text-app-text outline-none focus:ring-2 focus:ring-app-personal"
                  aria-label={`${d.label} start time`}
                />
                <span className="text-app-text-muted">–</span>
                <input
                  type="time"
                  value={d.end}
                  onChange={(e) => update(d.weekday, { end: e.target.value })}
                  className="rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-[12.5px] font-semibold tabular-nums text-app-text outline-none focus:ring-2 focus:ring-app-personal"
                  aria-label={`${d.label} end time`}
                />
              </div>
            ) : (
              <span className="ml-auto text-xs font-medium text-app-text-muted">
                Unavailable
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
