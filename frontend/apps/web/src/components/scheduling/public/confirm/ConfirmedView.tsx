// W6 · D3 — Booking confirmed / thank-you. Reached returning from Stripe or via
// the email-receipt link, so it loads purely from the manage token (no SSR of
// private data). Success-green hero for confirmed, info-blue hourglass + a
// 3-step timeline for pending-approval. Offers AddToCalendar (W0, .ics by token)
// and a manage link. Confetti on mount (suppressed under reduced motion).

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Hourglass,
  MailCheck,
  Settings2,
  UserPlus,
} from "lucide-react";
import clsx from "clsx";
import { publicBooking } from "@pantopus/api";
import type { BookingManageView } from "@pantopus/types";
import { buildBookingManagePath } from "@pantopus/utils";
import {
  AddToCalendar,
  decodeError,
  detectTimezone,
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import BookingSummaryCard from "./BookingSummaryCard";
import { formatCents, formatSlotRange } from "./confirmUtils";

// Pillar → border-bg token class (literal strings so Tailwind JIT picks them up)
const PILLAR_BORDER_BG: Record<string, string> = {
  personal: "border-app-personal-bg",
  home: "border-app-home-bg",
  business: "border-app-business-bg",
};

const CONFETTI_COLORS = ["#0284c7", "#059669", "#f59e0b", "#7c3aed", "#38bdf8"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: 6 + ((i * 5.6) % 88),
        delay: (i % 8) * 0.12,
        dur: 1.8 + (i % 5) * 0.25,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: i % 3 === 0 ? 5 : 6,
        h: i % 2 === 0 ? 9 : 6,
      })),
    [],
  );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-10 z-0 h-72 overflow-hidden"
    >
      <style>{`@keyframes pp-confetti{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:1}100%{opacity:0;transform:translateY(280px) rotate(420deg)}}`}</style>
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -14,
            left: `${b.left}%`,
            width: b.w,
            height: b.h,
            borderRadius: 1.5,
            background: b.color,
            opacity: 0,
            animation: `pp-confetti ${b.dur}s cubic-bezier(.3,.5,.5,1) ${b.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}

function Halo({ kind }: { kind: "success" | "pending" }) {
  const isSuccess = kind === "success";
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div
        className={clsx(
          "absolute inset-0 rounded-full opacity-50 motion-safe:animate-ping",
          isSuccess ? "bg-app-success-bg" : "bg-app-info-bg",
        )}
      />
      <div
        className={clsx(
          "relative flex h-20 w-20 items-center justify-center rounded-full border-2",
          isSuccess
            ? "border-app-success-light bg-app-success-bg text-app-success"
            : "border-app-info-light bg-app-info-bg text-app-info",
        )}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-9 w-9" strokeWidth={1.9} aria-hidden />
        ) : (
          <Hourglass className="h-9 w-9" strokeWidth={1.9} aria-hidden />
        )}
      </div>
    </div>
  );
}

function PendingTimeline() {
  const steps = [
    { label: "Submitted", state: "done" as const, sub: "Just now" },
    { label: "Awaiting host", state: "current" as const },
    { label: "Confirmed", state: "pending" as const },
  ];
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface px-2.5 py-4 shadow-sm">
      <div className="relative flex items-start justify-between">
        <div className="absolute left-[16.66%] right-[16.66%] top-3.5 h-0.5 bg-app-border" />
        <div className="absolute left-[16.66%] top-3.5 h-0.5 w-1/3 bg-app-info" />
        {steps.map((s) => (
          <div
            key={s.label}
            className="z-10 flex w-1/3 flex-col items-center gap-1.5"
          >
            <span
              className={clsx(
                "flex h-7 w-7 items-center justify-center rounded-full ring-4",
                s.state === "done"
                  ? "bg-app-success text-white ring-app-success-bg"
                  : s.state === "current"
                    ? "bg-app-info text-white ring-app-info-bg"
                    : "border-[1.5px] border-app-border-strong bg-app-surface ring-transparent",
              )}
            >
              {s.state === "done" && (
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              )}
              {s.state === "current" && (
                <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
              )}
            </span>
            <div className="text-center">
              <p
                className={clsx(
                  "text-[10.5px] leading-3",
                  s.state === "pending"
                    ? "font-medium text-app-text-secondary"
                    : "font-bold text-app-text",
                )}
              >
                {s.label}
              </p>
              {s.sub && (
                <p className="mt-0.5 text-[9px] font-medium text-app-text-secondary">
                  {s.sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmedSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <ShimmerBlock className="h-24 w-24 rounded-full" />
        <ShimmerBlock className="h-5 w-40 rounded" />
        <ShimmerBlock className="h-3 w-56 rounded" />
      </div>
      <ShimmerBlock className="h-40 w-full rounded-2xl" />
      <ShimmerBlock className="h-12 w-full rounded-xl" />
    </div>
  );
}

export default function ConfirmedView({ token }: { token: string }) {
  const [view, setView] = useState<BookingManageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await publicBooking.getBookingByToken(token);
        if (active) setView(res);
      } catch (err) {
        if (active) setError(decodeError(err).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(
        `pantopus.calendarly.justBooked.${token}`,
      );
      if (raw) {
        const parsed = JSON.parse(raw) as {
          celebrate?: boolean;
          confirmationMessage?: string | null;
        };
        if (parsed.celebrate && !prefersReducedMotion()) setCelebrate(true);
        if (parsed.confirmationMessage)
          setConfirmationMessage(parsed.confirmationMessage);
        window.sessionStorage.removeItem(
          `pantopus.calendarly.justBooked.${token}`,
        );
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  if (loading) return <ConfirmedSkeleton />;

  if (error || !view) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <p className="text-sm font-semibold text-app-text">
          We couldn&rsquo;t load this booking
        </p>
        <p className="mt-1 text-xs text-app-text-secondary">
          {error || "This link may be invalid or expired."}
        </p>
      </div>
    );
  }

  const { booking, eventType, page, payment } = view;
  // The public manage payload carries no owner / contact / payment-source
  // fields on the booking (trimmed ManageBookingRow) — pillar comes from the
  // page view, and the confirmation copy stays generic.
  const pillar = pillarForOwner(page?.owner_type);
  const tk = pillarTokens(pillar);
  const hostName = page?.title || "your host";
  const eventName = eventType?.name || "Your booking";
  const tz = booking.invitee_timezone || page?.timezone || detectTimezone();
  const isPending = booking.status === "pending";
  const hasPayment = Boolean(payment && payment.amount_total > 0);
  const managePath = buildBookingManagePath(token);

  return (
    <div className="relative mx-auto w-full max-w-md">
      {celebrate && !isPending && <Confetti />}

      <div className="relative z-10 space-y-4 px-4 py-6 pb-10">
        {/* Hero */}
        <div className="flex flex-col items-center gap-4 pt-2 text-center">
          <Halo kind={isPending ? "pending" : "success"} />
          <div>
            <h1 className="text-[21px] font-bold tracking-tight text-app-text">
              {isPending ? "Request sent" : "You're booked"}
            </h1>
            <p className="mx-auto mt-2 max-w-[16rem] text-[12.5px] leading-[18px] text-app-text-strong">
              {confirmationMessage ||
                (isPending
                  ? `${hostName} reviews each request before it's confirmed. We'll email you the moment it's set.`
                  : "Your booking is confirmed.")}
            </p>
          </div>
        </div>

        {isPending && <PendingTimeline />}
        {isPending && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-app-info-light bg-app-info-bg px-3 py-1.5 text-[11px] font-bold text-app-info">
              <Clock className="h-3 w-3" aria-hidden />
              Hosts usually reply within a day
            </span>
          </div>
        )}

        <BookingSummaryCard
          hostName={hostName}
          eventName={eventName}
          pillar={pillar}
          startISO={booking.start_at}
          endISO={booking.end_at}
          tz={tz}
          locationMode={eventType?.location_mode}
          locationDetail={eventType?.location_detail}
          inviteeName={booking.invitee_name}
        />

        {/* Receipt */}
        {hasPayment && payment ? (
          <div className="rounded-xl border border-app-success-light bg-app-success-bg px-3.5 py-3">
            <div className="flex items-center gap-2">
              <MailCheck
                className="h-4 w-4 shrink-0 text-app-success"
                aria-hidden
              />
              <span className="flex-1 text-[12px] font-bold text-app-success">
                {payment.payment_status === "processing"
                  ? "Payment processing"
                  : "Payment received"}
              </span>
              <span className="text-[15px] font-extrabold tabular-nums text-app-success">
                {formatCents(payment.amount_total, payment.currency)}
              </span>
            </div>
          </div>
        ) : null}

        {/* Add to calendar */}
        {!isPending && (
          <div className="rounded-2xl border border-app-border bg-app-surface px-2 py-1">
            <AddToCalendar
              event={{
                title: eventName,
                start: booking.start_at,
                end: booking.end_at,
                description: `Booking with ${hostName} — ${formatSlotRange(booking.start_at, booking.end_at, tz)}`,
              }}
              icsUrl={publicBooking.getIcsUrl(token)}
            />
          </div>
        )}

        {/* Manage link */}
        <Link
          href={managePath}
          className="flex items-start gap-2 px-1 text-[11.5px] leading-4 text-app-text-secondary"
        >
          <Settings2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-app-text-muted"
            aria-hidden
          />
          <span>
            Need to change it?{" "}
            <span className={clsx("font-bold", tk.text)}>
              Reschedule or cancel
            </span>{" "}
            anytime.
          </span>
        </Link>

        {/* Create-account nudge */}
        <Link
          href="/signup"
          className={clsx(
            "flex items-center gap-3 rounded-xl border px-3.5 py-3",
            tk.bgSoft,
            PILLAR_BORDER_BG[pillar],
          )}
        >
          <span
            className={clsx(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-app-surface",
              tk.text,
              PILLAR_BORDER_BG[pillar],
            )}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-app-text">
              Create an account to manage your bookings
            </span>
            <span className="block text-[10.5px] text-app-text-secondary">
              Reschedule, cancel, and rebook in one place.
            </span>
          </span>
          <CalendarClock
            className={clsx("h-4 w-4 shrink-0", tk.text)}
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}
