"use client";

// W15 · G11 — My Packages / remaining credits (customer). Buyer-side counterpart
// to the owner list. Source: GET /my-packages (remaining_sessions + nested
// BookingPackage). Buyer chrome is Personal sky; each card carries the owning
// pillar's accent. We only sell/list — actual redemption (apply-credit) lives in
// the booking flow (W7/W8), so "Book with a credit" hands off there.
//
// Backend note: my-packages exposes no expiry or redemption history, so the
// design's "expiring soon" banner and per-credit history are omitted (no data).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BadgeCheck, CalendarPlus, Ticket } from "lucide-react";
import * as api from "@pantopus/api";
import type { MyPackageCredit } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { useSchedulingOwner } from "@/components/scheduling/SchedulingOwnerProvider";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import {
  creditCountLabel,
  creditName,
  creditOwnerType,
  creditProgress,
  sortCredits,
} from "@/components/scheduling/packages/credits";
import { EmptyHero } from "@/components/scheduling/packages/ui";

export default function MyPackages() {
  const router = useRouter();
  const owner = useSchedulingOwner();

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [credits, setCredits] = useState<MyPackageCredit[]>([]);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getMyPackages(owner)
      .then((res) => {
        if (!alive) return;
        setCredits(sortCredits(res.credits ?? []));
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => load(), [load]);

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-app-text">My packages</h1>
        <p className="mt-0.5 text-sm text-app-text-secondary">
          Tap a credit to book your next session.
        </p>
      </header>

      {phase === "loading" && (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <ShimmerBlock key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      )}

      {phase === "error" && (
        <ErrorState message="We couldn't load your packages." onRetry={load} />
      )}

      {phase === "ready" && credits.length === 0 && (
        <EmptyHero
          icon={Ticket}
          pillar="personal"
          title="No packages yet"
          body="When you buy a package, your credits show up here."
          action={
            <button
              type="button"
              onClick={() => router.push("/app/scheduling")}
              className="rounded-xl border border-app-border bg-app-surface px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-app-hover"
            >
              Browse services
            </button>
          }
        />
      )}

      {phase === "ready" && credits.length > 0 && (
        <div className="flex flex-col gap-3">
          {credits.map((credit) => (
            <CreditCard
              key={credit.id}
              credit={credit}
              onBook={() => router.push("/app/scheduling/my-bookings")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CreditCard({
  credit,
  onBook,
}: {
  credit: MyPackageCredit;
  onBook: () => void;
}) {
  const progress = creditProgress(credit);
  const ownerType = creditOwnerType(credit);
  const tk = pillarTokens(pillarForOwner(ownerType));
  const spent = progress.state === "used";
  // Owner name: 'Personal provider' for personal, matches iOS/Android parity.
  const ownerName =
    ownerType === "business"
      ? "Business provider"
      : ownerType === "home"
        ? "Home provider"
        : "Personal provider";

  // Purchased date label — expiry date not available in contract; show purchase date.
  const purchasedLabel = (() => {
    const raw = credit.purchased_at;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  })();

  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm",
        spent && "opacity-75",
      )}
    >
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white",
              tk.bg,
            )}
            aria-hidden
          >
            {creditName(credit).charAt(0).toUpperCase()}
          </span>
          <span className="text-[12px] font-bold text-app-text">
            {ownerName}
          </span>
          <BadgeCheck className={clsx("h-3.5 w-3.5", tk.text)} aria-hidden />
        </div>

        <p className="mt-2.5 text-[14px] font-bold text-app-text">
          {creditName(credit)}
        </p>

        <div className="mb-2 mt-2 flex items-baseline justify-between">
          <span
            className={clsx(
              "text-lg font-extrabold tracking-tight",
              spent ? "text-app-text-muted" : "text-app-text",
            )}
          >
            {creditCountLabel(progress)}
          </span>
          {spent && (
            <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase text-app-text-muted">
              All used
            </span>
          )}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-app-surface-sunken"
          role="progressbar"
          aria-valuenow={progress.left}
          aria-valuemax={progress.total}
          aria-label="Sessions remaining"
        >
          <div
            className={clsx("h-full rounded-full")}
            style={{
              width: `${spent ? 100 : progress.pct}%`,
              // Design: meter is always personal-sky for active; border-strong for spent.
              backgroundColor: spent ? "var(--color-app-border-strong)" : "#0284c7",
            }}
          />
        </div>

        {purchasedLabel && (
          <p className="mt-1.5 text-[10.5px] text-app-text-muted">
            {spent ? `Ended (purchased ${purchasedLabel})` : `Purchased ${purchasedLabel}`}
          </p>
        )}

        {spent ? (
          <button
            type="button"
            onClick={onBook}
            className="mt-3 w-full rounded-xl border border-app-border bg-app-surface py-2.5 text-[13px] font-bold text-primary-700 transition hover:bg-app-hover"
          >
            Buy again
          </button>
        ) : (
          <button
            type="button"
            onClick={onBook}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-600 py-2.5 text-[13.5px] font-bold text-white shadow-sm transition hover:bg-primary-700"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Book with a credit
          </button>
        )}
      </div>
    </div>
  );
}
