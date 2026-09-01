"use client";

// W8 · E2 — Booking Detail. The authoritative screen one booking lives on.
// Header + identity strip, status-aware read cards (BookingDetailView), and a
// sticky action dock whose buttons change by lifecycle: pending → Approve /
// Decline; confirmed → Reschedule / Message (Cancel, Reassign, Nudge in the
// overflow). E3/E4/E5 are LOCAL sheets opened from here. Optimistic status
// then refetch; PAST_DEADLINE / ALREADY_* / INVALID_HOST guards live in the
// sheets/handlers.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  Check,
  ChevronLeft,
  Link2,
  MessageCircle,
  MoreVertical,
  RotateCcw,
  Send,
  TriangleAlert,
  UserCheck,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type { BookingDetail } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/toast-store";
import { confirmStore } from "@/components/ui/confirm-store";
import { webFeatureFlags } from "@/lib/featureFlags";
import { decodeError } from "@/components/scheduling/decodeError";
import { PRIMARY_BLUE_CLS } from "@/components/scheduling/pillarTokens";
import BookingStatusPill from "@/components/scheduling/BookingStatusPill";
import BookingDetailView from "@/components/scheduling/bookings/BookingDetailView";
import ApproveDeclineSheet from "@/components/scheduling/bookings/ApproveDeclineSheet";
import RescheduleReassignSheet from "@/components/scheduling/bookings/RescheduleReassignSheet";
import CancelRefundSheet from "@/components/scheduling/bookings/CancelRefundSheet";
import {
  canReassign,
  ownerFromQuery,
  PILLAR_LABEL,
  pillarOfOwner,
} from "@/components/scheduling/bookings/owners";
import { isPast } from "@/components/scheduling/bookings/bookingActions";
import { viewerTz } from "@/components/scheduling/bookings/format";

type Sheet = null | "approve" | "reschedule" | "cancel";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const sp = useSearchParams();
  const owner = useMemo(() => ownerFromQuery((k) => sp?.get(k) ?? null), [sp]);
  const pillar = pillarOfOwner(owner);
  const tz = useMemo(() => viewerTz(), []);
  const paid = webFeatureFlags.schedulingPaid;

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [approveMode, setApproveMode] = useState<"review" | "decline">(
    "review",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getBooking(id, owner)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [id, owner]);

  useEffect(() => load(), [load]);

  const refetch = useCallback(() => {
    api.scheduling
      .getBooking(id, owner)
      .then(setDetail)
      .catch(() => {});
  }, [id, owner]);

  const booking = detail?.booking ?? null;
  const eventName = detail?.eventType?.name || "Booking";
  const elapsed = booking ? isPast(booking) : false;

  const openApprove = (mode: "review" | "decline") => {
    setApproveMode(mode);
    setSheet("approve");
    setMenuOpen(false);
  };
  const openSheet = (s: Sheet) => {
    setSheet(s);
    setMenuOpen(false);
  };

  const markNoShow = async () => {
    setMenuOpen(false);
    const ok = await confirmStore.open({
      title: "Mark as no-show?",
      description: paid
        ? "Records that the invitee didn't attend and may apply a no-show fee."
        : "Records that the invitee didn't attend.",
      confirmLabel: "Mark no-show",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.scheduling.noShowBooking(id, owner);
      toast.success("Marked as no-show.");
      refetch();
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const nudge = async () => {
    setMenuOpen(false);
    setBusy(true);
    try {
      await api.scheduling.nudgeBooking(id, undefined, owner);
      toast.success("Reminder sent.");
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Dock + overflow definition by status ──────────────────────
  const messageHref = booking?.invitee_email
    ? `mailto:${booking.invitee_email}`
    : null;

  const menuItems: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    danger?: boolean;
  }> = [];
  if (booking) {
    const s = booking.status;
    if (s === "pending") {
      menuItems.push({
        label: "Approve",
        icon: Check,
        onClick: () => openApprove("review"),
      });
      menuItems.push({
        label: "Decline",
        icon: X,
        danger: true,
        onClick: () => openApprove("decline"),
      });
    } else if (s === "confirmed" && !elapsed) {
      menuItems.push({
        label: "Reschedule",
        icon: CalendarClock,
        onClick: () => openSheet("reschedule"),
      });
      if (canReassign(owner)) {
        menuItems.push({
          label: "Reassign",
          icon: UserCheck,
          onClick: () => openSheet("reschedule"),
        });
      }
      menuItems.push({ label: "Send a nudge", icon: Bell, onClick: nudge });
      menuItems.push({
        label: "Cancel booking",
        icon: XCircle,
        danger: true,
        onClick: () => openSheet("cancel"),
      });
    } else if (s === "confirmed" && elapsed) {
      menuItems.push({
        label: "Mark no-show",
        icon: UserX,
        danger: true,
        onClick: markNoShow,
      });
      menuItems.push({ label: "Send a nudge", icon: Bell, onClick: nudge });
    } else if (s === "completed") {
      menuItems.push({ label: "Send a nudge", icon: Bell, onClick: nudge });
    }
  }

  return (
    <div className="pb-28">
      {/* Top bar */}
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/app/scheduling/bookings"
          aria-label="Back to bookings"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text-secondary transition hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="flex-1" />
        {booking && <BookingStatusPill status={booking.status} />}
        {menuItems.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text-secondary transition hover:bg-app-hover disabled:opacity-50"
            >
              <MoreVertical className="h-5 w-5" aria-hidden />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div
                  role="menu"
                  className="absolute right-0 top-10 z-40 w-52 overflow-hidden rounded-xl border border-app-border bg-app-surface py-1 shadow-lg"
                >
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        onClick={item.onClick}
                        className={clsx(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition hover:bg-app-hover",
                          item.danger ? "text-app-error" : "text-app-text",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {phase === "loading" && <DetailSkeleton />}

      {phase === "error" && (
        <ErrorState message="We couldn't load this booking." onRetry={load} />
      )}

      {phase === "ready" && detail && booking && (
        <>
          <BookingDetailView
            detail={detail}
            pillar={pillar}
            tz={tz}
            ownerLabel={PILLAR_LABEL[pillar]}
          />

          {/* Conflict banner — shown above dock when hasConflict is true.
              TODO: wire hasConflict from API once backend provides conflict detection.
              The scaffold is here so it renders immediately when wired. */}
          {false /* detail.hasConflict */ && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <TriangleAlert
                className="h-[17px] w-[17px] shrink-0 text-amber-600"
                aria-hidden
              />
              <span className="flex-1 text-[11.5px] font-semibold leading-[15px] text-amber-700">
                This overlaps another booking
              </span>
              <button
                type="button"
                className="text-[11.5px] font-bold text-amber-700"
                onClick={() => {}}
              >
                View
              </button>
            </div>
          )}

          {/* Sticky action dock */}
          <Dock>
            {booking.status === "pending" && (
              <>
                <DockButton
                  tone="ghost-danger"
                  onClick={() => openApprove("decline")}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Decline
                </DockButton>
                <DockButton
                  tone="primary"
                  pillar={pillar}
                  onClick={() => openApprove("review")}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Approve
                </DockButton>
              </>
            )}

            {booking.status === "confirmed" &&
              !elapsed && (
                <>
                  <DockButton
                    tone={messageHref ? "ghost" : "primary"}
                    pillar={pillar}
                    onClick={() => openSheet("reschedule")}
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    Reschedule
                  </DockButton>
                  {messageHref && (
                    <DockLink tone="primary" pillar={pillar} href={messageHref}>
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Message
                    </DockLink>
                  )}
                </>
              )}

            {booking.status === "confirmed" &&
              elapsed && (
                <>
                  {messageHref && (
                    <DockLink tone="ghost" href={messageHref}>
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      Message
                    </DockLink>
                  )}
                  <DockButton
                    tone="primary"
                    pillar={pillar}
                    onClick={markNoShow}
                  >
                    <UserX className="h-4 w-4" aria-hidden />
                    Mark no-show
                  </DockButton>
                </>
              )}

            {/* Frame 3: completed → Rebook (ghost) + Follow up (primary) */}
            {booking.status === "completed" && (
              <>
                <DockButton tone="ghost" onClick={() => {}}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Rebook
                </DockButton>
                <DockButton tone="primary" pillar={pillar} onClick={() => {}}>
                  <Send className="h-4 w-4" aria-hidden />
                  Follow up
                </DockButton>
              </>
            )}

            {/* Frame 5: no_show → Message (ghost) + Send rebook link (primary) */}
            {booking.status === "no_show" && (
              <>
                {messageHref ? (
                  <DockLink tone="ghost" href={messageHref}>
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Message
                  </DockLink>
                ) : (
                  <DockButton tone="ghost" onClick={() => {}}>
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Message
                  </DockButton>
                )}
                <DockButton tone="primary" pillar={pillar} onClick={() => {}}>
                  <Link2 className="h-4 w-4" aria-hidden />
                  Send rebook link
                </DockButton>
              </>
            )}

            {/* Frame 4: cancelled → Rebook this time (primary) */}
            {booking.status === "cancelled" && (
              <DockButton tone="primary" pillar={pillar} onClick={() => {}}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Rebook this time
              </DockButton>
            )}
          </Dock>

          {/* Local sheets (E3 / E4 / E5) */}
          <ApproveDeclineSheet
            open={sheet === "approve"}
            onClose={() => setSheet(null)}
            booking={booking}
            eventName={eventName}
            owner={owner}
            pillar={pillar}
            initialMode={approveMode}
            onDone={refetch}
          />
          <RescheduleReassignSheet
            open={sheet === "reschedule"}
            onClose={() => setSheet(null)}
            booking={booking}
            owner={owner}
            pillar={pillar}
            onDone={refetch}
          />
          <CancelRefundSheet
            open={sheet === "cancel"}
            onClose={() => setSheet(null)}
            booking={booking}
            eventName={eventName}
            owner={owner}
            pillar={pillar}
            paid={paid}
            onDone={refetch}
          />
        </>
      )}
    </div>
  );
}

// ── Dock primitives ─────────────────────────────────────────

function Dock({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 mt-6 flex gap-2.5 border-t border-app-border bg-app-surface/95 py-3 backdrop-blur-md">
      {children}
    </div>
  );
}

type DockTone = "primary" | "ghost" | "ghost-danger";

// Design spec: BtnPrimary always uses PRIMARY = E.blue600 (#0284c7),
// never the owner-pillar accent. pillar param is accepted but not used
// for the primary tone — kept for call-site compatibility.
function dockClass(tone: DockTone, _pillar?: "personal" | "home" | "business") {
  if (tone === "primary") {
    return clsx(PRIMARY_BLUE_CLS.bg, PRIMARY_BLUE_CLS.textOn);
  }
  if (tone === "ghost-danger") {
    return "border border-app-error-light bg-app-surface text-app-error hover:bg-app-error-bg";
  }
  return "border border-app-border bg-app-surface text-app-text-secondary hover:bg-app-hover";
}

function DockButton({
  tone,
  pillar,
  onClick,
  children,
}: {
  tone: DockTone;
  pillar?: "personal" | "home" | "business";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
        dockClass(tone, pillar),
      )}
    >
      {children}
    </button>
  );
}

function DockLink({
  tone,
  pillar,
  href,
  children,
}: {
  tone: DockTone;
  pillar?: "personal" | "home" | "business";
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={clsx(
        "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
        dockClass(tone, pillar),
      )}
    >
      {children}
    </a>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <ShimmerBlock className="h-6 w-2/3 rounded" />
        <ShimmerBlock className="h-4 w-1/2 rounded" />
        <ShimmerBlock className="h-6 w-24 rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <ShimmerBlock key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
}
