"use client";

// F15 — Permission-gated scheduler. The household scheduler home: members with
// calendar.edit get a hub of scheduling surfaces; members without it get the
// Home agenda in read-only render-mode (hint bar + ask-to-manage + actionable
// own assignments), driven by HomeAgenda's gated mode. Must be rendered inside
// a HomePermissionsProvider.

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarClock,
  ChevronRight,
  Lock,
  Package,
  Users,
  UserCheck,
} from "lucide-react";
import { useHomePermissions } from "@/components/home/useHomePermissions";
import HomeAgenda from "./HomeAgenda";

export default function PermissionGate({
  homeId,
  currentUserId,
  accessRequested,
  onRequestAccess,
}: {
  homeId: string;
  currentUserId: string | null;
  accessRequested?: boolean;
  onRequestAccess?: () => void;
}) {
  const router = useRouter();
  const { access, loading, can } = useHomePermissions();

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-[60px] rounded-2xl bg-app-surface-sunken" />
        <div className="h-[60px] rounded-2xl bg-app-surface-sunken" />
        <div className="h-[60px] rounded-2xl bg-app-surface-sunken" />
      </div>
    );
  }

  const canEdit = can("calendar.edit");
  const canView = can("calendar.view") || !!access?.hasAccess;

  // No access at all → restricted.
  if (!canEdit && !canView) {
    return (
      <div className="flex flex-col items-center justify-center px-7 py-20 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-surface-sunken">
          <Lock className="h-7 w-7 text-app-text-muted" />
        </div>
        <div className="text-base font-bold text-app-text">
          You don&apos;t have access to this scheduler
        </div>
        <p className="mt-1.5 max-w-[240px] text-[12.5px] text-app-text-secondary">
          Ask a household admin to share the calendar with you.
        </p>
      </div>
    );
  }

  // Member without edit → gated read-only agenda (the F15 render-mode).
  if (!canEdit) {
    return (
      <HomeAgenda
        homeId={homeId}
        canEdit={false}
        currentUserId={currentUserId}
        accessRequested={accessRequested}
        onRequestAccess={onRequestAccess}
      />
    );
  }

  // Admin → scheduler hub.
  const base = `/app/homes/${homeId}`;
  const hubItems = [
    {
      icon: <CalendarDays className="h-5 w-5" />,
      label: "Household calendar",
      sub: "The full agenda and bookings",
      href: `${base}/calendar`,
    },
    {
      icon: <CalendarClock className="h-5 w-5" />,
      label: "My availability",
      sub: "What this household sees of your free/busy",
      href: `${base}/scheduling/availability`,
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "Find a time",
      sub: "A slot that works for everyone",
      href: `${base}/scheduling/find-a-time`,
    },
    {
      icon: <UserCheck className="h-5 w-5" />,
      label: "Who's free",
      sub: "Household availability at a glance",
      href: `${base}/scheduling/whos-free`,
    },
    {
      icon: <Package className="h-5 w-5" />,
      label: "Resources",
      sub: "Bookable spaces and gear",
      href: `${base}/scheduling/resources`,
    },
  ];

  return (
    <div className="space-y-2.5">
      {hubItems.map((it) => (
        <button
          key={it.href}
          onClick={() => router.push(it.href)}
          className="flex w-full items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3.5 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:border-app-home/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-home-bg text-app-home">
            {it.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold tracking-tight text-app-text">
              {it.label}
            </div>
            <div className="mt-0.5 text-[11.5px] text-app-text-secondary">
              {it.sub}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-app-text-muted" />
        </button>
      ))}
    </div>
  );
}
