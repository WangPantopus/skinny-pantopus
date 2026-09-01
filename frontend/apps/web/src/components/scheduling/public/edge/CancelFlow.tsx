"use client";

// D10 — Invitee cancel via the manage token. Reads the backend-computed
// `actions` + payment to frame the refund honestly (full / partial / none), or
// blocks with a fallback when cancelling online isn't allowed. Confirms via
// cancelByToken and lands on the first-class "cancelled" state.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, XCircle, MessageCircle } from "lucide-react";
import clsx from "clsx";
import type { BookingManageView } from "@pantopus/types";
import { publicBooking } from "@pantopus/api";
import {
  buildBookingManageAppUrl,
  buildBookingManagePath,
  buildBookingPagePath,
} from "@pantopus/utils";
import {
  CancellationPolicy,
  decodeError,
  pillarForOwner,
  type Pillar,
} from "@/components/scheduling";
import OpenInAppButton from "@/components/public-share/OpenInAppButton";
import ErrorState from "@/components/ui/ErrorState";
import BookingSummaryCard from "./BookingSummaryCard";
import StateRouter from "./StateRouter";
import {
  PolicyCard,
  deriveCancelPolicy,
  cancelPolicyCopy,
} from "./CutoffPolicyBlocked";
import { hostName, money, viewerTimezone } from "./edgeUtils";

function FlowShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-12 items-center border-b border-app-border bg-app-surface px-2">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-app-text hover:bg-app-hover"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-center text-[15px] font-semibold text-app-text">
          Cancel booking
        </h1>
        <span className="h-9 w-9" aria-hidden />
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </div>
  );
}

export default function CancelFlow({ token }: { token: string }) {
  const [view, setView] = useState<BookingManageView | null>(null);
  const [loadError, setLoadError] = useState<{
    notFound: boolean;
    message: string;
  } | null>(null);
  const [tz] = useState<string>(() => viewerTimezone());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelledReq = false;
    setView(null);
    setLoadError(null);
    publicBooking
      .getBookingByToken(token)
      .then((res) => {
        if (!cancelledReq) setView(res);
      })
      .catch((err) => {
        if (cancelledReq) return;
        const d = decodeError(err);
        setLoadError({
          notFound: d.kind === "not_found" || d.kind === "expired",
          message: d.message,
        });
      });
    return () => {
      cancelledReq = true;
    };
  }, [token, reloadKey]);

  // The public manage payload carries no owner fields on the booking — the
  // page view is the only pillar source (personal fallback when hidden).
  const pillar: Pillar = useMemo(
    () => pillarForOwner(view?.page?.owner_type ?? null),
    [view],
  );

  if (loadError) {
    if (loadError.notFound)
      return <StateRouter state="expired" message={loadError.message} />;
    return (
      <FlowShell>
        <ErrorState
          message={loadError.message}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </FlowShell>
    );
  }

  if (!view) {
    return (
      <FlowShell>
        <div className="h-28 animate-pulse rounded-2xl bg-app-surface-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-app-surface-muted" />
      </FlowShell>
    );
  }

  const { booking, actions, eventType, page, payment } = view;

  if (
    booking.status === "cancelled" ||
    booking.status === "declined" ||
    cancelled
  ) {
    return (
      <StateRouter
        state="cancelled"
        pillar={pillar}
        bookAgainHref={
          page ? buildBookingPagePath(page.slug) : buildBookingManagePath(token)
        }
      />
    );
  }

  const policy = deriveCancelPolicy(actions, Boolean(payment));
  const currency = payment?.currency || eventType?.currency || "USD";
  const copy = cancelPolicyCopy(policy, currency, tz);
  const canCancelOnline =
    policy.kind === "open_free" ||
    policy.kind === "open_partial" ||
    policy.kind === "open_no_refund";

  const refundCents =
    policy.kind === "open_partial"
      ? policy.refundCents
      : policy.kind === "open_free"
        ? (actions.refund_estimate_cents ?? payment?.amount_total ?? null)
        : 0;

  const cancelLabel =
    refundCents && refundCents > 0
      ? `Cancel and refund ${money(refundCents, currency)}`
      : "Cancel booking";

  const submit = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      await publicBooking.cancelByToken(token, {
        reason: reason.trim() || null,
      });
      setCancelled(true);
    } catch (err) {
      setActionError(decodeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FlowShell>
      <BookingSummaryCard
        booking={booking}
        eventType={eventType}
        page={page}
        tz={tz}
        pillar={pillar}
      />

      <PolicyCard
        tone={copy.tone}
        icon={copy.icon}
        title={copy.title}
        body={copy.body}
        still={copy.still}
      />

      {page?.cancellation_policy && (
        <CancellationPolicy policy={page.cancellation_policy} />
      )}

      {canCancelOnline ? (
        <>
          <div>
            <label
              htmlFor="cancel-reason"
              className="mb-1.5 block text-xs font-semibold text-app-text-secondary"
            >
              Reason (optional)
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Let the host know why, if you’d like."
              className="w-full resize-none rounded-xl border border-app-border bg-app-surface px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted focus:border-app-personal focus:outline-none"
            />
          </div>

          {actionError && (
            <div className="rounded-xl border border-app-error-light bg-app-error-bg p-3 text-xs font-semibold text-app-error">
              {actionError}
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-app-error-light bg-app-error-bg px-4 py-3 text-sm font-bold text-app-error hover:bg-app-error-bg/70 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" aria-hidden />
              {submitting ? "Cancelling…" : cancelLabel}
            </button>
            <Link
              href={buildBookingManagePath(token)}
              className="block w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-center text-sm font-bold text-app-text hover:bg-app-hover"
            >
              Keep my booking
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          <Link
            href={buildBookingManagePath(token)}
            className="block w-full rounded-xl border border-app-border bg-app-surface px-4 py-3 text-center text-sm font-bold text-app-text hover:bg-app-hover"
          >
            Keep my booking
          </Link>
          <OpenInAppButton
            appUrl={buildBookingManageAppUrl(token)}
            className={clsx(
              "flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold",
              "border-app-personal/40 bg-app-surface text-app-personal hover:bg-app-hover",
            )}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Message {hostName(page?.title)} in the app
          </OpenInAppButton>
        </div>
      )}
    </FlowShell>
  );
}
