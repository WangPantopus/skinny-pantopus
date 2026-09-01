"use client";

// D11 — My bookings (customer/booker-side). A signed-in user's outgoing
// bookings across every host (distinct from the host inbox + from my-packages).
// Segmented Upcoming/Past, grouped under relative overlines, each row tinted by
// the host's pillar. Design spec:
//   - Row avatar: 42px gradient-disc with white initials + 13px pillar dot (right:-1,bottom:-1).
//   - Primary line: event-type name (DEFERRED — backend /my-bookings payload omits it; falls back to date).
//   - Past rows: Book again footer (rotate-ccw + 'Book again', info blue).
//   - Needs-attention group: balance-due PayFooter + Approve-pending pill.
//   - Pending pill: INFO blue (handled by shared BookingStatusPill primitive).

import { useEffect, useMemo, useState } from "react";
import { Calendar, AlertCircle, RotateCcw } from "lucide-react";
import clsx from "clsx";
import type { Booking } from "@pantopus/types";
import { scheduling } from "@pantopus/api";
import {
  BookingStatusPill,
  decodeError,
  pillarTokens,
  pillarForOwner,
  useSchedulingOwner,
} from "@/components/scheduling";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import {
  formatDay,
  formatTime,
  tzAbbrev,
  timeGroup,
  isPastBooking,
  viewerTimezone,
  money,
  type BookingTimeGroup,
} from "./edgeUtils";

type Tab = "upcoming" | "past";

const UPCOMING_ORDER: BookingTimeGroup[] = [
  "Today",
  "This week",
  "Next week",
  "Later",
];
const PAST_ORDER: BookingTimeGroup[] = ["This month", "Earlier"];

// Pillar gradient map — matches design AV object (135° gradient).
const PILLAR_GRADIENT: Record<string, string> = {
  personal: "linear-gradient(135deg, #38bdf8, #0369a1)",
  home: "linear-gradient(135deg, #4ade80, #15803d)",
  business: "linear-gradient(135deg, #a78bfa, #6d28d9)",
};

/** Derive 2-char initials from a display name or owner label. */
function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Avatar: 42px gradient disc + pillar dot ─────────────────────────────────

function HostAvatar({
  pillar,
  initials,
  dim,
}: {
  pillar: string;
  initials: string;
  dim?: boolean;
}) {
  const tk = pillarTokens(pillar as "personal" | "home" | "business");
  return (
    <div
      className="relative shrink-0"
      style={{ opacity: dim ? 0.7 : 1 }}
    >
      <div
        className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[13px] font-bold text-white"
        style={{ background: PILLAR_GRADIENT[pillar] ?? PILLAR_GRADIENT.personal }}
      >
        {initials}
      </div>
      {/* pillar identity dot: right:-1, bottom:-1, 13px, 2.5px white border */}
      <span
        className={clsx("absolute h-[13px] w-[13px] rounded-full border-2 border-app-surface", tk.bg)}
        style={{ right: -1, bottom: -1 }}
      />
    </div>
  );
}

// ─── Attention-group overline ─────────────────────────────────────────────────

function AttentionOverline({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-app-warning">
      <AlertCircle className="h-3 w-3" aria-hidden />
      {children}
    </div>
  );
}

// ─── Book-again footer (Past tab) ─────────────────────────────────────────────

function BookAgainFooter({ onBookAgain }: { onBookAgain?: () => void }) {
  return (
    <div className="flex justify-end border-t border-app-border pt-2.5">
      <button
        type="button"
        onClick={onBookAgain}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-app-info hover:underline"
      >
        <RotateCcw className="h-3 w-3" aria-hidden />
        Book again
      </button>
    </div>
  );
}

// ─── Pay footer (balance-due attention rows) ───────────────────────────────────

function PayFooter({
  balance,
  currency,
  onPay,
}: {
  balance: number;
  currency: string;
  onPay?: () => void;
}) {
  const label = money(balance, currency);
  return (
    <div className="flex items-center justify-between border-t border-app-border pt-2.5">
      <span className="text-[11px] font-semibold text-app-warning">
        {label} due at confirm
      </span>
      <button
        type="button"
        onClick={onPay}
        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-app-info px-3.5 text-[11.5px] font-bold text-white"
      >
        Pay {label}
      </button>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ booking, tz }: { booking: Booking; tz: string }) {
  const pillar = pillarForOwner(booking.owner_type);
  const past = isPastBooking(booking);
  // NOTE: event-type name & host name are not in the lean /my-bookings payload
  // (deferredBackend — missing join). We fall back to date as primary line.
  const initials = getInitials(
    (booking as { invitee_name?: string }).invitee_name ?? null,
  );
  const hasBalance =
    (booking as { balance_due_cents?: number }).balance_due_cents != null &&
    (booking as { balance_due_cents?: number }).balance_due_cents! > 0;
  const balanceCents =
    (booking as { balance_due_cents?: number }).balance_due_cents ?? 0;
  const currency =
    (booking as { currency?: string }).currency ?? "USD";

  const hasFooter = past || hasBalance;

  return (
    <div
      className={clsx(
        "flex flex-col rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm",
        past && !hasBalance && "opacity-[0.66]",
        hasFooter && "gap-2.5",
      )}
    >
      <div className="flex items-center gap-3">
        <HostAvatar pillar={pillar} initials={initials} dim={past && !hasBalance} />
        <div className="min-w-0 flex-1">
          {/* Primary line: date (fallback — event-type name not in payload) */}
          <p className="truncate text-[13.5px] font-bold text-app-text">
            {formatDay(booking.start_at, tz)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-app-text-muted tabular-nums">
            {formatTime(booking.start_at, tz)}
            {booking.end_at ? ` – ${formatTime(booking.end_at, tz)}` : ""} ·{" "}
            {tzAbbrev(tz)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <BookingStatusPill status={booking.status} />
          {!hasFooter && (
            <span className="text-app-text-muted" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Pay footer for balance-due bookings (Needs attention group) */}
      {hasBalance && (
        <PayFooter balance={balanceCents} currency={currency} />
      )}

      {/* Book again for past rows */}
      {past && !hasBalance && (
        <BookAgainFooter />
      )}
    </div>
  );
}

function GroupedRows({
  bookings,
  order,
  past,
  tz,
}: {
  bookings: Booking[];
  order: BookingTimeGroup[];
  past: boolean;
  tz: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<BookingTimeGroup, Booking[]>();
    for (const b of bookings) {
      const g = timeGroup(b.start_at, past);
      const arr = map.get(g) ?? [];
      arr.push(b);
      map.set(g, arr);
    }
    return map;
  }, [bookings, past]);

  // Separate attention bookings (balance due or pending-approval) from the rest
  const attentionBookings = !past
    ? bookings.filter(
        (b) =>
          (b as { balance_due_cents?: number }).balance_due_cents! > 0 ||
          b.status === "pending",
      )
    : [];

  return (
    <div className="space-y-5">
      {/* Needs attention group */}
      {attentionBookings.length > 0 && (
        <div>
          <AttentionOverline>Needs attention</AttentionOverline>
          <div className="space-y-2.5">
            {attentionBookings.map((b) => (
              <Row key={b.id} booking={b} tz={tz} />
            ))}
          </div>
        </div>
      )}

      {/* Time-grouped rows */}
      {order
        .filter((g) => grouped.has(g))
        .map((g) => (
          <div key={g}>
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-app-text-muted">
              {g}
            </p>
            <div className="space-y-2.5">
              {(grouped.get(g) ?? [])
                .filter(
                  (b) =>
                    !attentionBookings.some((a) => a.id === b.id),
                )
                .map((b) => (
                  <Row key={b.id} booking={b} tz={tz} />
                ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface p-3 shadow-sm">
      <div className="h-[42px] w-[42px] shrink-0 animate-pulse rounded-full bg-app-surface-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-1/2 animate-pulse rounded bg-app-surface-muted" />
        <div className="h-2.5 w-2/3 animate-pulse rounded bg-app-surface-muted" />
      </div>
      <div className="h-5 w-16 animate-pulse rounded-full bg-app-surface-muted" />
    </div>
  );
}

export default function MyBookingsList() {
  const owner = useSchedulingOwner();
  const tz = useMemo(() => viewerTimezone(), []);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBookings(null);
    setError(null);
    scheduling
      .getMyBookings(owner)
      .then((res) => {
        if (cancelled) return;
        setBookings(res.bookings ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(decodeError(err).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner.ownerType, owner.ownerId, owner.homeId, reloadKey]);

  const { upcoming, past } = useMemo(() => {
    const list = bookings ?? [];
    const up = list
      .filter((b) => !isPastBooking(b))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    const pa = list
      .filter((b) => isPastBooking(b))
      .sort((a, b) => b.start_at.localeCompare(a.start_at));
    return { upcoming: up, past: pa };
  }, [bookings]);

  const active = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      {/* Segmented control */}
      <div className="mb-5 flex gap-1 rounded-xl bg-app-surface-sunken p-1">
        {(["upcoming", "past"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={clsx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors",
              tab === t
                ? "bg-app-surface text-app-text shadow-sm"
                : "text-app-text-muted hover:text-app-text",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : bookings === null ? (
        <div className="space-y-2.5">
          <div className="mb-2 h-2.5 w-20 animate-pulse rounded bg-app-surface-muted" />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : active.length === 0 ? (
        tab === "upcoming" ? (
          <EmptyState
            icon={Calendar}
            title="You haven't booked anything yet"
            description="Bookings you make show up here — everything in one place."
          />
        ) : (
          <EmptyState
            icon={Calendar}
            title="No past bookings"
            description="Bookings you've completed or that have passed will show up here."
          />
        )
      ) : (
        <GroupedRows
          bookings={active}
          order={tab === "upcoming" ? UPCOMING_ORDER : PAST_ORDER}
          past={tab === "past"}
          tz={tz}
        />
      )}

      {bookings !== null && !error && active.length > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-app-text-muted">
          <AlertCircle className="h-3 w-3" aria-hidden />
          Times shown in {tzAbbrev(tz)}.
        </p>
      )}
    </div>
  );
}
