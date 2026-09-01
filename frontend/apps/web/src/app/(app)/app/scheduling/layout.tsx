"use client";

// Host scheduling shell (W0). AppShell chrome is already applied by the parent
// (app)/app layout — this adds the scheduling section nav, with links to EVERY
// feature-stream area pre-included so each is reachable the moment it merges
// (before then they 404, which is expected during the parallel build). Only the
// layout + nav live here; each section's page.tsx is owned by its feature stream.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Clock,
  CreditCard,
  FileText,
  Inbox,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Package,
  Radio,
  Search,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  SchedulingOwnerProvider,
  useSchedulingOwner,
} from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarTokens,
  pillarForOwner,
} from "@/components/scheduling/pillarTokens";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const BASE = "/app/scheduling";

const SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: BASE, label: "Hub", icon: LayoutDashboard },
      { href: `${BASE}/booking-page`, label: "Booking page", icon: Link2 },
      {
        href: `${BASE}/event-types`,
        label: "Event types",
        icon: CalendarClock,
      },
      { href: `${BASE}/availability`, label: "Availability", icon: Clock },
    ],
  },
  {
    title: "Bookings",
    items: [
      { href: `${BASE}/bookings`, label: "Bookings", icon: Inbox },
      { href: `${BASE}/bookings/search`, label: "Search", icon: Search },
      { href: `${BASE}/waitlist`, label: "Waitlist", icon: Users },
      {
        href: `${BASE}/my-bookings`,
        label: "My bookings",
        icon: CalendarCheck,
      },
    ],
  },
  {
    title: "Business",
    items: [
      { href: `${BASE}/business`, label: "Business", icon: Briefcase },
      { href: `${BASE}/payments`, label: "Payments", icon: CreditCard },
      { href: `${BASE}/packages`, label: "Packages", icon: Package },
      { href: `${BASE}/invoices`, label: "Invoices", icon: FileText },
      { href: `${BASE}/my-packages`, label: "My packages", icon: Boxes },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: `${BASE}/reminders`, label: "Reminders", icon: Bell },
      { href: `${BASE}/workflows`, label: "Workflows", icon: Workflow },
      { href: `${BASE}/templates`, label: "Templates", icon: MessageSquare },
      { href: `${BASE}/insights`, label: "Insights", icon: BarChart3 },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        href: `${BASE}/connected-calendars`,
        label: "Connected calendars",
        icon: CalendarPlus,
      },
      { href: `${BASE}/settings/channels`, label: "Channels", icon: Radio },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === BASE) return pathname === BASE;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SchedulingNav() {
  const pathname = usePathname();
  const owner = useSchedulingOwner();
  const tk = pillarTokens(pillarForOwner(owner.ownerType));

  return (
    <nav aria-label="Scheduling" className="lg:w-60 lg:shrink-0">
      <div className="mb-4 hidden lg:block">
        <p
          className={clsx(
            "text-xs font-bold uppercase tracking-wider",
            tk.text,
          )}
        >
          Calendarly
        </p>
        <h2 className="text-lg font-bold text-app-text-strong">Scheduling</h2>
      </div>

      {/* Mobile: horizontal scroll. Desktop: stacked sections. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
        {SECTIONS.map((section) => (
          <div key={section.title} className="contents lg:block lg:mb-4">
            <p className="hidden lg:mb-1 lg:block lg:px-2 lg:text-[11px] lg:font-semibold lg:uppercase lg:tracking-wide lg:text-app-text-muted">
              {section.title}
            </p>
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full",
                    active
                      ? clsx(tk.bgSoft, tk.text)
                      : "text-app-text-secondary hover:bg-app-hover hover:text-app-text",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

export default function SchedulingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SchedulingOwnerProvider>
      <div className="mx-auto max-w-6xl px-4 py-6 lg:flex lg:gap-8">
        <SchedulingNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </SchedulingOwnerProvider>
  );
}
