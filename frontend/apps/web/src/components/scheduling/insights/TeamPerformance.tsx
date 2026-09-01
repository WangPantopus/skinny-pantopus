"use client";

// W17 · H12 — Team Performance (business-only). Per-host bookings and
// no-show rate from GET /insights/team, whose real payload is
// { window_days, hosts: [{ host_user_id, total, confirmed, completed,
// no_show, cancelled }] } — no names, revenue or durations. Host display
// names are resolved best-effort from the business members endpoint; rows
// fall back to a short host-id form. Two-option sort (Bookings / No-show
// rate), metric strip showing bookings + no-show rate per host.
// For non-business owners (or a BUSINESS_ONLY response) we show a notice.

import { useEffect, useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";
import * as api from "@pantopus/api";
import type { TeamInsights } from "@pantopus/types";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { useReport } from "./useReport";
import { useInsightsFilters } from "./useInsightsFilters";
import { insightsDays } from "./filters";
import { formatCount, formatRate, rateOf } from "./format";
import { isBusinessOnly, isBusinessOwner } from "./gating";
import {
  Avatar,
  Card,
  EmptyReport,
  InlineRetry,
  NoticeCard,
  ReportSkeleton,
} from "./ui";

/** Fallback display for a host the members endpoint didn't resolve. */
function hostFallbackName(hostUserId: string): string {
  return `Host ${hostUserId.slice(0, 8)}`;
}

// Two-option sort, mirroring iOS/Android (bookings / no-show only — revenue
// sort removed since it diverged from native without a design spec).
type SortKey = "bookings" | "no_show";

const SORTS: ReadonlyArray<{ id: SortKey; label: string }> = [
  { id: "bookings", label: "Bookings" },
  { id: "no_show", label: "No-show rate" },
];

/** Fraction (0–1) no-show rate for a host row: no-shows ÷ settled. */
function hostNoShowRate(h: TeamInsights["hosts"][number]): number {
  return rateOf(h.no_show, h.completed + h.no_show);
}

export default function TeamPerformance() {
  const owner = useSchedulingOwner();
  const pillar = pillarForOwner(owner.ownerType);
  const { filters, query } = useInsightsFilters();
  const ownerKey = `${owner.ownerType}:${owner.ownerId ?? owner.homeId ?? ""}`;
  const business = isBusinessOwner(owner);
  const [sort, setSort] = useState<SortKey>("bookings");
  // host_user_id → display name, resolved from the business members endpoint
  // (the insights payload carries ids only).
  const [hostNames, setHostNames] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );

  const { phase, data, error, reload } =
    useReport<TeamInsights | null>(async () => {
      if (!business) return null;
      return api.scheduling.getTeamInsights(insightsDays(filters), owner);
    }, [query, ownerKey, business]);

  useEffect(() => {
    if (!business || !owner.ownerId) return;
    let alive = true;
    api.businessIam
      .getTeamMembers(owner.ownerId)
      .then((res) => {
        if (!alive) return;
        setHostNames(
          new Map(
            (res.members ?? []).map((m) => [
              m.user.id,
              m.user.name || m.user.username,
            ]),
          ),
        );
      })
      .catch(() => {
        /* best-effort — rows fall back to a short host-id form */
      });
    return () => {
      alive = false;
    };
  }, [business, owner.ownerId]);

  const hosts = useMemo(() => {
    const list = data?.hosts ? [...data.hosts] : [];
    if (sort === "no_show")
      list.sort((a, b) => hostNoShowRate(b) - hostNoShowRate(a));
    else list.sort((a, b) => b.total - a.total);
    return list;
  }, [data, sort]);

  if (!business)
    return (
      <NoticeCard
        icon={Building2}
        title="Team performance is for business accounts"
        body="Switch to a business profile to see per-member bookings and no-show rates for your team."
        tone="info"
      />
    );

  if (phase === "loading") return <ReportSkeleton kpis={0} />;
  if (phase === "error") {
    if (error && isBusinessOnly(error))
      return (
        <NoticeCard
          icon={Building2}
          title="Team performance is for business accounts"
          body="This report is only available for business owners with a team."
          tone="info"
        />
      );
    return (
      <InlineRetry
        message="We couldn't load team performance. Try again."
        onRetry={reload}
      />
    );
  }
  if (!data)
    return (
      <InlineRetry
        message="We couldn't load team performance. Try again."
        onRetry={reload}
      />
    );

  if (hosts.length === 0)
    return (
      <EmptyReport
        icon={Users}
        title="No team activity yet"
        body="Once your team members start taking bookings in this period, their performance will show here."
        pillar={pillar}
      />
    );

  const maxBookings = hosts.reduce((m, x) => Math.max(m, x.total), 0);

  return (
    <div className="space-y-4">
      <Card
        title="By member"
        icon={Users}
        action={
          <div className="flex gap-0.5 rounded-[10px] bg-app-surface-sunken p-0.5">
            {SORTS.map((s) => {
              const on = s.id === sort;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSort(s.id)}
                  aria-pressed={on}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    on
                      ? "bg-app-surface text-app-text-strong shadow-sm"
                      : "text-app-text-secondary hover:text-app-text"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        }
      >
        <ul className="divide-y divide-app-border-subtle">
          {hosts.map((h) => {
            const name =
              hostNames.get(h.host_user_id) ??
              hostFallbackName(h.host_user_id);
            const pct =
              maxBookings > 0 ? Math.round((h.total / maxBookings) * 100) : 0;
            return (
              <li key={h.host_user_id} className="py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={name} pillar={pillar} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-app-text">
                      {name}
                    </span>
                    <span className="block text-xs text-app-text-muted">
                      {formatCount(h.total)}{" "}
                      {h.total === 1 ? "booking" : "bookings"} ·{" "}
                      {formatRate(hostNoShowRate(h))} no-show
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-[17px] font-bold tabular-nums text-app-text">
                      {formatCount(h.total)}
                    </span>
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
                      bookings
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-app-surface-sunken">
                  <div
                    className="h-full rounded-full bg-app-business"
                    style={{
                      width: `${Math.max(pct, h.total > 0 ? 4 : 0)}%`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
