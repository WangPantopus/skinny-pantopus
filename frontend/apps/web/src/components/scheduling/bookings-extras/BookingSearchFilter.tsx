"use client";

// E9 — Booking Search & Filter (the filter sheet). Edits the live filter model
// in place: status / owner-context / event-type / date facets + a free-text query
// that searches invitee name and intake text (q maps to GET /bookings?q=). The CTA
// reflects the current result count and just closes the sheet (results update live
// behind it). Empty result replaces all facets with a no-results state.

import { Search, SearchX, X } from "lucide-react";
import clsx from "clsx";
import BottomSheet from "@/components/ui/BottomSheet";
import { FilterChip, SectionOverline, type ChipTone } from "./ui";
import {
  DATE_FACETS,
  STATUS_FACETS,
  type BookingFilters,
  type OwnerScopeFacet,
  countActiveFilters,
} from "./filters";

interface EventTypeOption {
  id: string;
  name: string;
}

// Per-semantic tint for the active-filter summary chips.
// Status tones mirror STATUS_FACETS; scope uses pillar colors.
const SCOPE_CHIP_CLS: Record<OwnerScopeFacet, string> = {
  all: "bg-app-info-bg text-app-info",
  personal: "bg-sky-50 text-sky-700",
  home: "bg-green-50 text-green-700",
  business: "bg-violet-50 text-violet-700",
};

const STATUS_CHIP_TONE: Record<string, ChipTone> = {
  upcoming: "success",
  pending: "warning",
  past: "info",
  cancelled: "error",
  no_show: "error",
};

const CHIP_ACTIVE_CLS: Record<ChipTone, string> = {
  neutral: "bg-app-info-bg text-app-info",
  success: "bg-app-success-bg text-app-success",
  warning: "bg-app-warning-bg text-app-warning",
  error: "bg-app-error-bg text-app-error",
  info: "bg-app-info-bg text-app-info",
};

const OWNER_SCOPE_OPTIONS: Array<{ id: OwnerScopeFacet; label: string }> = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal" },
  { id: "home", label: "Home" },
  { id: "business", label: "Business" },
];

export default function BookingSearchFilter({
  open,
  onClose,
  filters,
  onChange,
  eventTypes,
  resultCount,
  loading,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  filters: BookingFilters;
  onChange: (next: BookingFilters) => void;
  eventTypes: EventTypeOption[];
  resultCount: number | null;
  loading: boolean;
  onClear: () => void;
}) {
  if (!open) return null;

  const activeCount = countActiveFilters(filters);
  const hasResults = (resultCount ?? 0) > 0;
  const noMatches = resultCount === 0 && activeCount > 0;

  const set = (patch: Partial<BookingFilters>) =>
    onChange({ ...filters, ...patch });

  const toggleStatus = (id: BookingFilters["status"]) =>
    set({ status: filters.status === id ? "all" : id });
  const toggleDate = (id: BookingFilters["date"]) =>
    set({ date: filters.date === id ? "all" : id });
  const toggleEventType = (id: string) =>
    set({ eventTypeId: filters.eventTypeId === id ? null : id });
  const toggleScope = (id: OwnerScopeFacet) =>
    set({ scope: filters.scope === id ? "all" : id });

  // Active-filter summary chips with per-semantic tints.
  const activeChips: Array<{ label: string; cls: string; onRemove: () => void }> = [];
  if (filters.status !== "all") {
    const s = STATUS_FACETS.find((f) => f.id === filters.status);
    if (s)
      activeChips.push({
        label: s.label,
        cls: CHIP_ACTIVE_CLS[s.tone],
        onRemove: () => set({ status: "all" }),
      });
  }
  if (filters.scope !== "all") {
    const scopeLabel =
      OWNER_SCOPE_OPTIONS.find((o) => o.id === filters.scope)?.label ??
      filters.scope;
    activeChips.push({
      label: scopeLabel,
      cls: SCOPE_CHIP_CLS[filters.scope],
      onRemove: () => set({ scope: "all" }),
    });
  }
  if (filters.eventTypeId) {
    const et = eventTypes.find((e) => e.id === filters.eventTypeId);
    activeChips.push({
      label: et?.name ?? "Event type",
      cls: "bg-app-info-bg text-app-info",
      onRemove: () => set({ eventTypeId: null }),
    });
  }
  if (filters.date !== "all") {
    const d = DATE_FACETS.find((f) => f.id === filters.date);
    if (d)
      activeChips.push({
        label: d.label,
        cls: "bg-app-info-bg text-app-info",
        onRemove: () => set({ date: "all" }),
      });
  }

  const ctaLabel = loading
    ? "Updating…"
    : resultCount === null
      ? "Show bookings"
      : noMatches
        ? "No matches"
        : `Show ${resultCount} booking${resultCount === 1 ? "" : "s"}`;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={!hasResults && activeCount > 0}
          className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-surface-sunken disabled:text-app-text-muted"
        >
          {ctaLabel}
        </button>
      }
    >
      <div className="px-1">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-app-text">Filter bookings</h3>
          <button
            type="button"
            onClick={onClear}
            disabled={activeCount === 0}
            className="text-[13px] font-semibold text-primary-600 disabled:text-app-text-muted"
          >
            Clear all
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-app-border bg-app-surface-sunken px-3">
          <Search className="h-4 w-4 text-app-text-muted" aria-hidden />
          <input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search invitee or intake text"
            aria-label="Search invitee or intake text"
            className="w-full bg-transparent py-2.5 text-sm text-app-text placeholder:text-app-text-muted focus:outline-none"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => set({ q: "" })}
              aria-label="Clear search"
              className="text-app-text-muted hover:text-app-text"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        {/* Active summary */}
        {activeChips.length > 0 && (
          <div className="mb-4">
            <SectionOverline className="mb-2">Active filters</SectionOverline>
            <div className="flex flex-wrap gap-2">
              {activeChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.onRemove}
                  className={clsx(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold",
                    c.cls,
                  )}
                >
                  {c.label}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Facets — replaced by no-results state when count=0 */}
        {noMatches ? (
          <div className="mt-2 flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken text-app-text-muted">
              <SearchX className="h-6 w-6" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-app-text">
                No bookings match these filters
              </p>
              <button
                type="button"
                onClick={onClear}
                className="mt-2 text-xs font-semibold text-primary-600"
              >
                Clear all
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="mb-4">
              <SectionOverline className="mb-2">Status</SectionOverline>
              <div className="flex flex-wrap gap-2">
                {STATUS_FACETS.map((f) => (
                  <FilterChip
                    key={f.id}
                    label={f.label}
                    tone={f.tone}
                    active={filters.status === f.id}
                    onClick={() => toggleStatus(f.id)}
                  />
                ))}
              </div>
            </div>

            {/* Owner context */}
            <div className="mb-4">
              <SectionOverline className="mb-2">Owner context</SectionOverline>
              <div className="flex flex-wrap gap-2">
                {OWNER_SCOPE_OPTIONS.map((o) => {
                  const active = filters.scope === o.id;
                  // Pillar chips use the pillar color when active.
                  const activeCls =
                    o.id === "all"
                      ? "bg-app-info-bg text-app-info"
                      : SCOPE_CHIP_CLS[o.id];
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleScope(o.id)}
                      className={clsx(
                        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors",
                        active
                          ? activeCls
                          : "border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover",
                      )}
                    >
                      {active && o.id !== "all" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                      )}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event type */}
            {eventTypes.length > 0 && (
              <div className="mb-4">
                <SectionOverline className="mb-2">Event type</SectionOverline>
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map((et) => (
                    <FilterChip
                      key={et.id}
                      label={et.name}
                      active={filters.eventTypeId === et.id}
                      onClick={() => toggleEventType(et.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Date range */}
            <div className="mb-2">
              <SectionOverline className="mb-2">Date range</SectionOverline>
              <div className="flex flex-wrap gap-2">
                {DATE_FACETS.map((f) => (
                  <FilterChip
                    key={f.id}
                    label={f.label}
                    active={filters.date === f.id}
                    onClick={() => toggleDate(f.id)}
                  />
                ))}
              </div>
              {filters.date === "custom" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase text-app-text-muted">
                      From
                    </span>
                    <input
                      type="date"
                      value={filters.from ?? ""}
                      onChange={(e) => set({ from: e.target.value || null })}
                      className="w-full rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase text-app-text-muted">
                      To
                    </span>
                    <input
                      type="date"
                      value={filters.to ?? ""}
                      onChange={(e) => set({ to: e.target.value || null })}
                      className="w-full rounded-lg border border-app-border bg-app-surface-sunken px-3 py-2 text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    />
                  </label>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
