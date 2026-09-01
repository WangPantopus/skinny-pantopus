"use client";

// W15 · G12 — Invoices List (owner, business-only). The financial hub for
// bookings + package sales. Summary (outstanding / collected this month), a
// status filter, day-grouped rows, and search. A Stripe gate when payments
// aren't connected (you invoice through Stripe). All behind schedulingPaid.
//
// Backend note: GET /invoices guarantees only id, recipient_user_id,
// total_cents, currency, created_at. Status / payer name / number / service are
// read defensively (see invoiceHelpers) and degrade gracefully — never faked.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Receipt, Search, X } from "lucide-react";
import * as api from "@pantopus/api";
import type {
  Invoice,
  PaymentsStatus,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import { pillarForOwner } from "@/components/scheduling/pillarTokens";
import { formatCents } from "@/components/scheduling/packages/money";
import {
  INVOICE_FILTERS,
  filterInvoices,
  formatInvoiceAmount,
  groupByDay,
  initialsFor,
  invoiceNumber,
  invoiceServiceLabel,
  invoiceStatus,
  matchesQuery,
  recipientLabel,
  summarizeInvoices,
  type InvoiceStatus,
} from "@/components/scheduling/packages/invoiceHelpers";
import {
  EmptyHero,
  InvoiceStatusPill,
  PillarPill,
  StripeGate,
} from "@/components/scheduling/packages/ui";
import PaidFeatureGate from "@/components/scheduling/packages/PaidFeatureGate";

const BASE = "/app/scheduling/invoices";

export default function InvoiceList({ owner }: { owner: SchedulingOwnerRef }) {
  const router = useRouter();
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentsStatus | null>(null);
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .listInvoices(owner)
      .then((res) => {
        if (!alive) return;
        setInvoices(res.invoices ?? []);
        setPhase("ready");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    api.scheduling
      .getPaymentsStatus(owner)
      .then((res) => {
        if (alive) setPayments(res);
      })
      .catch(() => {
        /* gate hidden if status unknown */
      });
    return () => {
      alive = false;
    };
  }, [owner]);

  useEffect(() => load(), [load]);

  const summary = useMemo(() => summarizeInvoices(invoices), [invoices]);
  const visible = useMemo(
    () =>
      filterInvoices(invoices, filter).filter((inv) =>
        matchesQuery(inv, query),
      ),
    [invoices, filter, query],
  );
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const notConnected = Boolean(payments?.applicable && !payments.connected);

  return (
    <PaidFeatureGate feature="Invoices">
      <div className="mx-auto max-w-2xl">
        <header className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2">
                <PillarPill pillar={pillar} />
              </div>
              <h1 className="text-xl font-bold text-app-text">Invoices</h1>
              <p className="mt-0.5 text-sm text-app-text-secondary">
                Everything you&apos;ve invoiced for bookings and packages.
              </p>
            </div>
            <button
              type="button"
              aria-label={searching ? "Close search" : "Search invoices"}
              onClick={() => {
                setSearching((s) => !s);
                setQuery("");
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-text-secondary hover:bg-app-hover"
            >
              {searching ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Search className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>

          {searching && phase === "ready" && (
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, number, or service"
              className="mt-3 w-full rounded-lg border-[1.5px] border-app-border bg-app-surface px-3 py-2.5 text-sm text-app-text placeholder:text-app-text-muted outline-none transition focus:border-primary-600 focus:ring-2 focus:ring-primary-600/15"
            />
          )}
        </header>

        {phase === "loading" && (
          <div className="flex flex-col gap-3">
            <ShimmerBlock className="h-20 rounded-2xl" />
            <ShimmerBlock className="h-64 rounded-2xl" />
          </div>
        )}

        {phase === "error" && (
          <ErrorState
            message="We couldn't load your invoices."
            onRetry={load}
          />
        )}

        {phase === "ready" && notConnected && invoices.length === 0 && (
          <StripeGate
            title="Connect payments to invoice for services"
            body="Pantopus uses Stripe to send and collect invoices."
          />
        )}

        {phase === "ready" && !(notConnected && invoices.length === 0) && (
          <>
            {invoices.length === 0 ? (
              <EmptyHero
                icon={Receipt}
                pillar={pillar}
                title="No invoices yet"
                body="Invoices appear here once you take a booking or sell a package."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {notConnected && (
                  <StripeGate
                    compact
                    title="Connect payments to send and collect"
                    body="Stripe isn't connected yet, so these invoices can't be sent."
                  />
                )}

                <SummaryCard
                  outstandingCents={summary.outstandingCents}
                  collectedCents={summary.collectedCents}
                  currency={summary.currency}
                />

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {INVOICE_FILTERS.map((f) => {
                    const on = filter === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilter(f.value)}
                        className={clsx(
                          "h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[11.5px] font-bold transition",
                          on
                            ? "bg-app-business text-white"
                            : "border border-app-border bg-app-surface text-app-text-secondary hover:border-app-border-strong",
                        )}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                {visible.length === 0 ? (
                  <p className="px-1 py-10 text-center text-sm text-app-text-secondary">
                    No invoices match.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <p className="border-b border-app-border bg-app-surface-raised px-4 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-app-text-muted">
                          {group.label}
                        </p>
                        {group.items.map((inv) => (
                          <InvoiceRow
                            key={inv.id}
                            invoice={inv}
                            onOpen={() =>
                              router.push(
                                `${BASE}/${encodeURIComponent(inv.id)}`,
                              )
                            }
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PaidFeatureGate>
  );
}

function SummaryCard({
  outstandingCents,
  collectedCents,
  currency,
}: {
  outstandingCents: number;
  collectedCents: number;
  currency: string;
}) {
  const hasOutstanding = outstandingCents > 0;
  return (
    <div className="flex rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
      <div className="flex-1 pr-3">
        <p
          className={clsx(
            "text-[10px] font-bold uppercase tracking-[0.06em]",
            hasOutstanding ? "text-app-warning" : "text-app-text-muted",
          )}
        >
          Outstanding
        </p>
        <p
          className={clsx(
            "mt-0.5 text-xl font-extrabold tracking-tight tabular-nums",
            hasOutstanding ? "text-app-warning" : "text-app-text",
          )}
        >
          {formatCents(outstandingCents, currency)}
        </p>
      </div>
      <div className="w-px bg-app-border" aria-hidden />
      <div className="flex-1 pl-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-app-text-muted">
          Collected · month
        </p>
        <p className="mt-0.5 text-xl font-extrabold tracking-tight tabular-nums text-app-text">
          {formatCents(collectedCents, currency)}
        </p>
      </div>
    </div>
  );
}

function InvoiceRow({
  invoice,
  onOpen,
}: {
  invoice: Invoice;
  onOpen: () => void;
}) {
  const name = recipientLabel(invoice);
  const service = invoiceServiceLabel(invoice);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-app-border px-4 py-3 text-left transition last:border-b-0 hover:bg-app-hover"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-surface-sunken text-[11px] font-bold text-app-text-secondary"
        aria-hidden
      >
        {initialsFor(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-app-text">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[10.5px] text-app-text-muted">
          <span className="font-mono">{invoiceNumber(invoice)}</span>
          {service ? ` · ${service}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[13.5px] font-bold tabular-nums text-app-text">
          {formatInvoiceAmount(invoice)}
        </span>
        <span className="mt-1 inline-block">
          <InvoiceStatusPill status={invoiceStatus(invoice)} />
        </span>
      </span>
    </button>
  );
}
