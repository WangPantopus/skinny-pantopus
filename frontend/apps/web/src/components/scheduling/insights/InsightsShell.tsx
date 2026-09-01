"use client";

// W17 — the chrome shared by all four insights reports: a pillar-themed header
// with an identity switcher (Personal / Home / Business), the active period
// chip (opens the H13 sheet) and the report sub-tabs. Because /app/scheduling
// resolves to the personal owner by route, the switcher resolves Home/Business
// owner refs (like the Hub) and overrides the W0 SchedulingOwnerProvider for
// the report below — so every report is owner-polymorphic. Selection + period
// live in the URL so they survive navigation between tabs.

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CalendarRange, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { SchedulingOwnerRef } from "@pantopus/types";
import { SchedulingOwnerProvider } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";
import InsightsTabs, { type InsightsTab } from "./InsightsTabs";
import PeriodFilterSheet from "./PeriodFilterSheet";
import { useInsightsFilters } from "./useInsightsFilters";
import { PILLAR_ORDER, useInsightsOwners } from "./useInsightsOwners";
import { bookingRange, presetLabel } from "./filters";
import { formatRangeLabel } from "./format";
import { PillarSwitch, type PillarOption } from "./ui";

const PILLAR_LABEL: Record<Pillar, string> = {
  personal: "Personal",
  home: "Home",
  business: "Business",
};

const VALID_PILLAR: ReadonlySet<string> = new Set([
  "personal",
  "home",
  "business",
]);

export default function InsightsShell({
  active,
  title,
  subtitle,
  children,
}: {
  active: InsightsTab;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { owners } = useInsightsOwners();
  const { filters, setFilters } = useInsightsFilters();
  const [sheetOpen, setSheetOpen] = useState(false);

  const requested = (searchParams?.get("owner") ?? "personal") as Pillar;
  const wanted: Pillar = VALID_PILLAR.has(requested) ? requested : "personal";
  // Fall back to personal until/unless the requested pillar resolves an owner.
  const pillar: Pillar = owners[wanted].owner ? wanted : "personal";
  const owner: SchedulingOwnerRef = owners[pillar].owner ?? {
    ownerType: "user",
  };
  const tk = pillarTokens(pillar);

  const setPillar = (p: Pillar) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (p === "personal") sp.delete("owner");
    else sp.set("owner", p);
    const base = pathname ?? "";
    const s = sp.toString();
    router.replace(s ? `${base}?${s}` : base, { scroll: false });
  };

  const pillarOptions: PillarOption[] = PILLAR_ORDER.map((p) => ({
    pillar: p,
    label: PILLAR_LABEL[p],
    available: !!owners[p].owner,
  }));

  const periodLabel =
    filters.preset === "custom" && filters.from && filters.to
      ? formatRangeLabel(filters.from, filters.to)
      : presetLabel(filters.preset);
  const range = bookingRange(filters);
  const filtered = !!filters.eventTypeId;
  const tabQuery = searchParams?.toString() ?? "";

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p
              className={clsx(
                "text-[11px] font-bold uppercase tracking-[0.08em]",
                tk.text,
              )}
            >
              Insights
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-app-text-strong">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-app-text-secondary">{subtitle}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PillarSwitch
              options={pillarOptions}
              active={pillar}
              onSelect={setPillar}
            />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-left shadow-sm hover:bg-app-hover"
            >
              <CalendarRange
                className={clsx("h-4 w-4 shrink-0", tk.text)}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
                  Period
                </span>
                <span className="block truncate text-[13px] font-bold text-app-text">
                  {periodLabel}
                </span>
              </span>
              {filtered && (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    tk.bgSoft,
                    tk.text,
                  )}
                >
                  <SlidersHorizontal className="h-3 w-3" aria-hidden />
                  Filtered
                </span>
              )}
              <ChevronDown
                className="h-4 w-4 shrink-0 text-app-text-muted"
                aria-hidden
              />
            </button>
          </div>
        </div>

        <InsightsTabs
          active={active}
          pillar={pillar}
          query={tabQuery}
          showTeam={pillar === "business"}
        />
      </header>

      <p className="text-xs text-app-text-muted">
        Showing {formatRangeLabel(range.from, range.to)}
      </p>

      <SchedulingOwnerProvider owner={owner}>
        {children}
      </SchedulingOwnerProvider>

      <PeriodFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filters}
        onApply={setFilters}
        owner={owner}
        pillar={pillar}
      />
    </div>
  );
}
