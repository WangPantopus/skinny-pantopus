"use client";

// Searchable timezone sheet. Opens from the slot picker's tz chip. Structure
// mirrors the design (timezone-selector-frames.jsx):
//   • "Detected" section label → single-item ListCard for the device zone
//   • "Common" section label → ListCard with all zones
//   • each ZoneRow: leftmost 18px check slot (pillar accent), name + Detected
//     pill chip, then right-aligned GMT offset + local time
//   • search collapses to a single "Results" card; no-match → dashed empty card
//   • manual override → info banner ("You changed this…" + Reset to detected)
// Functional chrome (Done, links) uses fixed sky #0284c7; the selected check
// uses the host's pillar accent.

import { useMemo, useState, type ReactNode } from "react";
import { Check, Info, RotateCcw, Search, SearchX } from "lucide-react";
import clsx from "clsx";
import BottomSheet from "@/components/ui/BottomSheet";
import { pillarTokens, type Pillar } from "./pillarTokens";

const COMMON_ZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function zoneLabel(tz: string): string {
  const tail = tz.split("/").pop() || tz;
  return tail.replace(/_/g, " ");
}

function offsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

function localTime(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}

interface TimezoneSelectorProps {
  open: boolean;
  onClose: () => void;
  value?: string;
  onSelect: (tz: string) => void;
  pillar?: Pillar;
}

function ZoneRow({
  tz,
  selected,
  detected,
  accentClass,
  onPick,
}: {
  tz: string;
  selected: boolean;
  detected: boolean;
  accentClass: string;
  onPick: (tz: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(tz)}
      aria-pressed={selected}
      aria-label={`${zoneLabel(tz)}${selected ? ", selected" : ""}${
        detected ? ", detected from your device" : ""
      }`}
      className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-app-hover"
    >
      {/* leftmost 18px check slot */}
      <span className="flex w-[18px] shrink-0 justify-center">
        {selected && (
          <Check
            className={clsx("h-[18px] w-[18px]", accentClass)}
            strokeWidth={2.6}
            aria-hidden
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-app-text">
          {zoneLabel(tz)}
        </span>
        {detected && (
          <span className="shrink-0 rounded-full bg-app-info-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-app-info">
            Detected
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-xs font-semibold tabular-nums text-app-text-strong">
          {offsetLabel(tz)}
        </span>
        <span className="block text-[10px] tabular-nums text-app-text-muted">
          {localTime(tz)}
        </span>
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-1 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-app-text-secondary first:pt-0">
      {children}
    </div>
  );
}

function ListCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm divide-y divide-app-border-subtle">
      {children}
    </div>
  );
}

export default function TimezoneSelector({
  open,
  onClose,
  value,
  onSelect,
  pillar = "personal",
}: TimezoneSelectorProps) {
  const [query, setQuery] = useState("");
  const detected = useMemo(detectTimezone, []);
  const tk = pillarTokens(pillar);

  const commonOnly = useMemo(
    () => COMMON_ZONES.filter((z) => z !== detected),
    [detected],
  );
  const q = query.trim().toLowerCase();
  const matchesQuery = (z: string) =>
    z.toLowerCase().includes(q) || zoneLabel(z).toLowerCase().includes(q);
  const searchResults = useMemo(
    () =>
      q
        ? Array.from(new Set([detected, ...COMMON_ZONES])).filter(matchesQuery)
        : [],
    [q, detected],
  );

  const isOverridden = Boolean(value && value !== detected);

  const handlePick = (tz: string) => {
    onSelect(tz);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Time zone"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold text-app-info hover:underline"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        {/* Search field */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-secondary"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or time zone"
            aria-label="Search time zones"
            className="w-full rounded-lg border border-app-border bg-app-surface-sunken py-2 pl-9 pr-3 text-sm text-app-text placeholder:text-app-text-muted focus:border-app-info focus:bg-app-surface focus:outline-none focus:ring-1 focus:ring-app-info"
          />
        </div>

        {/* Manual-override info banner */}
        {isOverridden && !q && (
          <div className="flex items-start gap-2.5 rounded-xl border border-app-info-light bg-app-info-bg px-3 py-2.5">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-info"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-snug text-app-info">
                You changed this from your detected zone.
              </p>
              <button
                type="button"
                onClick={() => handlePick(detected)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-app-info hover:underline"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={2.4} aria-hidden />
                Reset to detected
              </button>
            </div>
          </div>
        )}

        {q ? (
          searchResults.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-app-border-strong bg-app-surface px-6 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-surface-sunken">
                <SearchX
                  className="h-6 w-6 text-app-text-secondary"
                  strokeWidth={1.85}
                  aria-hidden
                />
              </span>
              <p className="text-sm font-semibold text-app-text">
                No time zones match “{query}”
              </p>
              <p className="max-w-[190px] text-xs text-app-text-secondary">
                Try a city name.
              </p>
            </div>
          ) : (
            <>
              <SectionLabel>Results</SectionLabel>
              <ListCard>
                {searchResults.map((tz) => (
                  <ZoneRow
                    key={tz}
                    tz={tz}
                    selected={tz === value}
                    detected={tz === detected}
                    accentClass={tk.text}
                    onPick={handlePick}
                  />
                ))}
              </ListCard>
            </>
          )
        ) : (
          <div className="max-h-[50vh] space-y-0 overflow-y-auto">
            <SectionLabel>Detected</SectionLabel>
            <ListCard>
              <ZoneRow
                tz={detected}
                selected={detected === value}
                detected
                accentClass={tk.text}
                onPick={handlePick}
              />
            </ListCard>
            <SectionLabel>Common</SectionLabel>
            <ListCard>
              {commonOnly.map((tz) => (
                <ZoneRow
                  key={tz}
                  tz={tz}
                  selected={tz === value}
                  detected={false}
                  accentClass={tk.text}
                  onPick={handlePick}
                />
              ))}
            </ListCard>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
