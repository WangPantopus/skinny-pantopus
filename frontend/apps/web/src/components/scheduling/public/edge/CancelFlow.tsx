"use client";

// D10 — Invitee cancel via the manage token. Reads the backend-computed
// `actions` + payment to frame the refund honestly (full / partial / none), or
// blocks with a fallback when cancelling online isn't allowed. Confirms via
// cancelByToken and lands on the first-class "cancelled" state.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    let cancelledReq = false;
    generation.current += 1;
    setView(null);
    setLoadError(null);
    setActionError(null);
    setSubmitting(false);
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
      generation.current += 1;
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
  const submit = async () => {
    if (submitting) return;
    const requestGeneration = generation.current;
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await publicBooking.cancelByToken(token, {
        reason: reason.trim() || null,
      });
      if (requestGeneration !== generation.current) return;
      if (
        result.booking.id !== booking.id ||
        result.booking.status !== "cancelled"
      ) {
        throw new Error(
          "Cancellation could not be confirmed. Check your booking and retry.",
        );
      }
      setView({
        ...view,
        booking: { ...booking, status: "cancelled" },
        cancellation_payment: result.cancellation_payment,
      });
    } catch (err) {
      if (requestGeneration !== generation.current) return;
      setActionError(decodeError(err).message);
      // A lost reply can follow a committed cancellation. Read the same booking
      // before offering another cancel; GET never starts a provider operation.
      try {
        const current = await publicBooking.getBookingByToken(token);
        if (
          requestGeneration === generation.current &&
          current.booking.id === booking.id
        )
          setView(current);
      } catch {
        /* Keep the original actionable error and draft. */
      }
    } finally {
      if (requestGeneration === generation.current) setSubmitting(false);
    }
  };

  if (booking.status === "cancelled" || booking.status === "declined") {
    const outcome = view.cancellation_payment;
    const needsAttention =
      outcome && !["succeeded", "not_required"].includes(outcome.status);
    return (
      <StateRouter
        state="cancelled"
        pillar={pillar}
        message={outcome?.message}
        bookAgainHref={
          needsAttention
            ? null
            : page
              ? buildBookingPagePath(page.slug)
              : buildBookingManagePath(token)
        }
      >
        {needsAttention && (
          <div className="space-y-2.5">
            {actionError && (
              <p className="text-xs text-app-error" role="alert">
                {actionError}
              </p>
            )}
            <button
              type="button"
              onClick={
                outcome.can_retry ? submit : () => setReloadKey((k) => k + 1)
              }
              disabled={submitting}
              className="text-sm font-semibold text-app-text-secondary underline hover:text-app-text disabled:opacity-60"
            >
              {submitting
                ? "Checking payment…"
                : outcome.can_retry
                  ? "Retry payment recovery"
                  : "Check payment status"}
            </button>
          </div>
        )}
      </StateRouter>
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
