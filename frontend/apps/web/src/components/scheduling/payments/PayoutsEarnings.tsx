"use client";

// W14 · G7 — Payouts & Earnings (scheduling-scoped). A violet balance hero
// (available · pending · this month) over a source-filter chip row, a
// best-effort recent-activity list, the payout-method tile (connect-gated /
// re-verify states), and a "manage & withdraw in Wallet" handoff. Payout
// SETTLEMENT is deferred server-side, so pending earnings render as
// "processing/pending" — never as cleared. Business violet accent.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownToLine,
  Banknote,
  CalendarCheck,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Layers,
  Lock,
  Receipt,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import * as api from "@pantopus/api";
import type {
  PaymentsStatus,
  SchedulingOwnerRef,
  StripeAccount,
} from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { Card, InlineNote, SectionLabel, formatUsd } from "./kit";

interface Earnings {
  available: number;
  pending: number;
  this_month: number;
  total_earned: number;
}

type Source = "all" | "booking" | "package" | "gig";
type RowSource = "booking" | "package" | "gig" | "fee" | "payout";

interface ActivityRow {
  id: string;
  desc: string;
  when: string;
  amountCents: number;
  outgoing: boolean;
  pending: boolean;
  source: RowSource;
}

const FILTERS: Array<{ key: Source; label: string }> = [
  { key: "all", label: "All" },
  { key: "booking", label: "Booking earnings" },
  { key: "package", label: "Packages" },
  { key: "gig", label: "Gigs" },
];

function classify(tx: Record<string, any>): RowSource {
  const blob = `${tx.payment_type ?? ""} ${tx.entry_type ?? ""} ${
    tx.description ?? ""
  } ${tx.gig?.title ?? ""}`.toLowerCase();
  if (tx.entry_type === "payout" || /payout/.test(blob)) return "payout";
  if (tx.booking_id || tx.booking || /\bbooking\b/.test(blob)) return "booking";
  if (tx.package_id || /package/.test(blob)) return "package";
  if (tx.gig || tx.gig_id || /gig/.test(blob)) return "gig";
  if (tx.payment_type === "fee" || /\bfee\b/.test(blob)) return "fee";
  return "booking";
}

function toRow(tx: Record<string, any>): ActivityRow {
  const source = classify(tx);
  const amountCents =
    Number(tx.amount_cents ?? tx.amount_total ?? tx.amount ?? 0) || 0;
  const status = String(
    tx.status ?? tx.payment_status ?? tx.payout_status ?? "",
  ).toLowerCase();
  const pending = /pending|processing|hold|scheduled/.test(status);
  const outgoing =
    source === "payout" || source === "fee" || tx.direction === "debit";
  return {
    id: String(tx.id ?? `${tx.created_at ?? ""}-${amountCents}`),
    desc:
      tx.gig?.title ||
      tx.description ||
      (source === "payout"
        ? "Payout to bank"
        : source === "fee"
          ? "Service fee"
          : "Booking earning"),
    when: tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "",
    amountCents,
    outgoing,
    pending,
    source,
  };
}

const SOURCE_ICON = {
  booking: CalendarCheck,
  package: Layers,
  gig: Receipt,
  fee: Receipt,
  payout: Banknote,
} as const;

function Hero({ earnings, hold }: { earnings: Earnings; hold?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 text-white shadow-lg"
      style={{ background: "linear-gradient(155deg, #075985 0%, #0369a1 55%, #0284c7 100%)", boxShadow: "0 10px 24px rgba(2,132,199,0.28)" }}
    >
      <svg
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -right-9 -top-12 h-44 w-44 opacity-20"
        aria-hidden
      >
        <circle
          cx="100"
          cy="100"
          r="90"
          stroke="#fff"
          strokeWidth="1"
          fill="none"
        />
        <circle
          cx="100"
          cy="100"
          r="60"
          stroke="#fff"
          strokeWidth="1"
          fill="none"
        />
        <circle
          cx="100"
          cy="100"
          r="30"
          stroke="#fff"
          strokeWidth="1"
          fill="none"
        />
      </svg>
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-sky-200">
          Available to withdraw
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9.5px] font-bold uppercase text-white">
          USD
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="mt-1.5 self-start text-lg font-bold text-sky-200">$</span>
        <span className="text-4xl font-extrabold tabular-nums tracking-tight">
          {formatUsd(earnings.available).replace(/^\$/, "")}
        </span>
      </div>
      <div className="mt-3 flex rounded-xl border border-white/15 bg-white/10 p-2.5">
        <div className="flex-1 pr-3">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-sky-200">
            <Clock className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
            Pending
          </div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-white">
            {formatUsd(earnings.pending)}
          </div>
          <div className="mt-0.5 text-[9.5px] text-sky-200/80">
            {/* sub-label rendered only when data available */}
          </div>
        </div>
        <div className="w-px bg-white/15" />
        <div className="flex-1 pl-3">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-sky-200">
            <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
            This month
          </div>
          <div className="mt-0.5 text-base font-bold tabular-nums text-white">
            {formatUsd(earnings.this_month)}
          </div>
        </div>
      </div>
      {hold && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/45 bg-amber-300/20 px-2.5 py-2">
          <ShieldAlert className="h-[13px] w-[13px] shrink-0 text-amber-200" aria-hidden />
          <div>
            <div className="text-[11px] font-bold text-amber-50">
              Withdrawals paused
            </div>
            <div className="text-[10px] text-amber-100/90">
              Funds are safe while we re-verify your bank.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayoutsEarnings({
  owner,
}: {
  owner?: SchedulingOwnerRef;
}) {
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [earnings, setEarnings] = useState<Earnings>({
    available: 0,
    pending: 0,
    this_month: 0,
    total_earned: 0,
  });
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [filter, setFilter] = useState<Source>("booking");

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    Promise.allSettled([
      api.scheduling.getPaymentsStatus(owner),
      api.payments.getStripeAccount(),
      api.payments.getEarnings(),
      api.payments.getTransactionHistory(),
    ]).then(([s, a, e, t]) => {
      if (!alive) return;
      const anyOk =
        s.status === "fulfilled" ||
        e.status === "fulfilled" ||
        t.status === "fulfilled";
      if (s.status === "fulfilled") setStatus(s.value);
      setAccount(a.status === "fulfilled" ? (a.value.account ?? null) : null);
      if (e.status === "fulfilled") {
        const raw = ((e.value as any)?.earnings ?? e.value ?? {}) as Record<
          string,
          any
        >;
        setEarnings({
          available: Number(raw.available ?? 0) || 0,
          pending: Number(raw.pending ?? 0) || 0,
          this_month: Number(raw.this_month ?? raw.thisMonth ?? 0) || 0,
          total_earned: Number(raw.total_earned ?? raw.totalEarned ?? 0) || 0,
        });
      }
      if (t.status === "fulfilled") {
        const list: any[] =
          (t.value as any)?.transactions ?? (t.value as any)?.payments ?? [];
        setRows(list.map(toRow));
      }
      setPhase(anyOk ? "ready" : "error");
    });
    return () => {
      alive = false;
    };
  }, [owner, reloadKey]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((r) => r.source === filter || r.source === "payout"),
    [rows, filter],
  );

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  if (phase === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <ShimmerBlock className="h-40 rounded-2xl" />
        <ShimmerBlock className="h-9 w-2/3 rounded-full" />
        <ShimmerBlock className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <ErrorState message="We couldn't load your earnings." onRetry={retry} />
    );
  }

  if (status && status.applicable === false) {
    return (
      <InlineNote tone="info" icon={CreditCard}>
        Booking earnings are tracked per person. Switch to a personal or
        business space to see payouts.
      </InlineNote>
    );
  }

  const payoutsEnabled = !!account?.payouts_enabled;
  const onHold =
    !!account?.details_submitted &&
    !payoutsEnabled &&
    !!account?.charges_enabled;
  const connected = !!account;
  const isEmpty =
    earnings.available === 0 &&
    earnings.pending === 0 &&
    earnings.this_month === 0 &&
    rows.length === 0;

  return (
    <div className="flex flex-col gap-3 pb-4">
      {onHold && (
        <InlineNote tone="warning" icon={ShieldAlert}>
          Your bank needs re-verifying. A 2-minute check unlocks payouts —
          earnings keep landing and stay safe.
        </InlineNote>
      )}

      <Hero earnings={earnings} hold={onHold} />

      {/* Source filter chips. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          const biz = on && f.key === "booking";
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              className={clsx(
                "h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors",
                on
                  ? biz
                    ? "bg-app-business text-white"
                    : "bg-primary-600 text-white"
                  : "border border-app-border bg-app-surface text-app-text-strong hover:bg-app-hover",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <SectionLabel accent={filter === "booking"}>
        {FILTERS.find((f) => f.key === filter)?.label ?? "Activity"}
      </SectionLabel>

      {isEmpty || filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2.5 border-dashed px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-app-business-bg text-app-business">
            <CalendarCheck className="h-6 w-6" strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-sm font-bold text-app-text">
            No booking earnings yet
          </p>
          <p className="max-w-[15rem] text-xs leading-snug text-app-text-secondary">
            Your booking earnings will show up here next to your gigs.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {filtered.slice(0, 8).map((r, i) => {
            const Icon = SOURCE_ICON[r.source] ?? CalendarCheck;
            const tinted = r.source === "booking" || r.source === "package";
            return (
              <div
                key={r.id}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3",
                  i < Math.min(filtered.length, 8) - 1 &&
                    "border-b border-app-border-subtle",
                )}
              >
                <span
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    tinted
                      ? "bg-app-business-bg text-app-business"
                      : "bg-app-surface-sunken text-app-text-strong",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-app-text">
                      {r.desc}
                    </span>
                    {r.pending && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-amber-700">
                        Pending
                      </span>
                    )}
                  </div>
                  {r.when && (
                    <div className="text-xs text-app-text-secondary">
                      {r.when}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={clsx(
                      "text-sm font-bold tabular-nums",
                      r.outgoing
                        ? "text-app-text-strong"
                        : r.pending
                          ? "text-amber-700"
                          : "text-green-700",
                    )}
                  >
                    {r.outgoing ? "−" : "+"}
                    {formatUsd(r.amountCents)}
                  </div>
                  <div className="text-[10px] text-app-text-muted">
                    {r.source === "fee"
                      ? "Fee"
                      : r.outgoing
                        ? "Payout"
                        : r.pending
                          ? "Pending"
                          : "Cleared"}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Payout method. */}
      <SectionLabel>Payout method</SectionLabel>
      {connected && payoutsEnabled ? (
        <Card className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-surface-sunken text-app-text-strong">
            <Banknote className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-app-text">
              Bank account on file
            </div>
            <div className="text-xs text-app-text-secondary">
              Payouts handled by Stripe · 1–2 business days
            </div>
          </div>
        </Card>
      ) : onHold ? (
        <Card className="flex items-center gap-3 border-amber-200 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <AlertCircle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-app-text">
              Verification expired
            </div>
            <div className="text-xs text-amber-700">
              Re-verify your bank in Setup to unlock payouts.
            </div>
          </div>
        </Card>
      ) : (
        <Link
          href="/app/scheduling/payments"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-app-border-strong bg-app-surface px-4 py-3 transition hover:bg-app-hover"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: "#635BFF" }}
            aria-hidden
          >
            <CreditCard className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-semibold text-app-text-strong">
            Connect Stripe to get paid out
          </span>
        </Link>
      )}

      {/* Tax Documents row — shown when payouts are enabled (mirrors iOS/Android TaxDocsRow condition). */}
      {payoutsEnabled && !isEmpty && (
        <>
          <SectionLabel>Taxes</SectionLabel>
          <Card
            className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-app-hover"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-bold text-app-text">
                Tax documents
              </div>
              <div className="mt-0.5 text-xs text-app-text-secondary">
                YTD earnings · docs available mid-Jan
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-app-text-muted" aria-hidden />
          </Card>
        </>
      )}

      <InlineNote tone="info" icon={Clock}>
        Payouts settle through Stripe — pending booking earnings show as
        processing until they clear.
      </InlineNote>

      {/* Withdraw button — sky primary per design (wallet-earnings-frames.jsx:166-173).
          Settlement is server-side; this routes to the Wallet withdraw flow. */}
      {payoutsEnabled && !onHold ? (
        <Link
          href="/app/wallet"
          className="inline-flex h-12 items-center justify-between gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-95"
          style={{ background: "#0284c7", boxShadow: "0 6px 16px rgba(2,132,199,0.28)" }}
        >
          <span className="inline-flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" aria-hidden />
            Withdraw
          </span>
          <span className="tabular-nums">{formatUsd(earnings.available)}</span>
        </Link>
      ) : (
        <div>
          <button
            type="button"
            disabled
            className="inline-flex h-12 w-full cursor-not-allowed items-center justify-between gap-2 rounded-xl border border-app-border bg-app-surface-sunken px-4 text-sm font-bold text-app-text-muted"
          >
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4" aria-hidden />
              Withdraw
            </span>
            <span className="tabular-nums">
              {formatUsd(earnings.available)}
            </span>
          </button>
          <p className="mt-1.5 text-center text-xs text-app-text-secondary">
            {onHold
              ? "Re-verify your bank in Setup to unlock payouts."
              : "Finish Stripe setup to withdraw."}
          </p>
        </div>
      )}
    </div>
  );
}
