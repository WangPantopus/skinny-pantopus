"use client";

// W17 — sub-navigation across the four insights reports. The section's single
// left-nav "Insights" link lands on the dashboard; these tabs switch between
// the reports while preserving the active period (the serialized filters ride
// along in the query). The Team tab only shows for business owners (H12 is
// business-only).

import Link from "next/link";
import clsx from "clsx";
import { BarChart3, CalendarClock, UserX, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  pillarTokens,
  type Pillar,
} from "@/components/scheduling/pillarTokens";

export type InsightsTab = "dashboard" | "event-types" | "no-shows" | "team";

const BASE = "/app/scheduling/insights";

const TABS: ReadonlyArray<{
  id: InsightsTab;
  label: string;
  href: string;
  icon: LucideIcon;
  businessOnly?: boolean;
}> = [
  { id: "dashboard", label: "Dashboard", href: BASE, icon: BarChart3 },
  {
    id: "event-types",
    label: "Event types",
    href: `${BASE}/event-types`,
    icon: CalendarClock,
  },
  { id: "no-shows", label: "No-shows", href: `${BASE}/no-shows`, icon: UserX },
  {
    id: "team",
    label: "Team",
    href: `${BASE}/team`,
    icon: Users,
    businessOnly: true,
  },
];

export default function InsightsTabs({
  active,
  pillar,
  query,
  showTeam,
}: {
  active: InsightsTab;
  pillar: Pillar;
  query: string;
  showTeam: boolean;
}) {
  const tk = pillarTokens(pillar);
  const suffix = query ? `?${query}` : "";
  const tabs = TABS.filter((t) => !t.businessOnly || showTeam);

  return (
    <div
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      role="tablist"
      aria-label="Insights reports"
    >
      {tabs.map((t) => {
        const on = t.id === active;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={`${t.href}${suffix}`}
            role="tab"
            aria-selected={on}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors",
              on
                ? clsx(tk.bgSoft, tk.text)
                : "text-app-text-secondary hover:bg-app-hover hover:text-app-text",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
