"use client";

// W15 · G13 — Invoice Detail (owner). ContentDetail: mono header, total hero,
// payer/payee cards, line-items table, lifecycle timeline, and a Send action.
// Status pill in the page header. All behind schedulingPaid.
//
// Backed mutation = POST /invoices/:id/send (notifies the recipient; per the
// API it does NOT mutate invoice state, so we don't fake a status change).
// Mark-paid / refund / PDF aren't backend-supported, so they're omitted rather
// than shown as dead buttons. Line items, totals, and timeline render from
// real fields and degrade gracefully.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  List,
  Send,
  Share2,
} from "lucide-react";
import * as api from "@pantopus/api";
import type {
  Invoice,
  SchedulingInvoiceLineItem as InvoiceLineItem,
  SchedulingOwnerRef,
} from "@pantopus/types";
import { toast } from "@/components/ui/toast-store";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import ErrorState from "@/components/ui/ErrorState";
import {
  pillarForOwner,
  pillarTokens,
} from "@/components/scheduling/pillarTokens";
import { decodeError } from "@/components/scheduling/decodeError";
import { formatCents } from "@/components/scheduling/packages/money";
import {
  formatInvoiceAmount,
  initialsFor,
  invoiceNumber,
  invoiceStatus,
  lineItemAmountCents,
  lineItemsSubtotalCents,
  recipientLabel,
  timelineEvents,
} from "@/components/scheduling/packages/invoiceHelpers";
import { InvoiceStatusPill } from "@/components/scheduling/packages/ui";
import PaidFeatureGate from "@/components/scheduling/packages/PaidFeatureGate";

const BASE = "/app/scheduling/invoices";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export default function InvoiceDetail({
  id,
  owner,
}: {
  id: string;
  owner: SchedulingOwnerRef;
}) {
  const router = useRouter();
  const pillar = pillarForOwner(owner.ownerType);

  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setPhase("loading");
    api.scheduling
      .getInvoice(id, owner)
      .then((res) => {
        if (!alive) return;
        setInvoice(res.invoice ?? null);
        setPhase(res.invoice ? "ready" : "error");
      })
      .catch(() => {
        if (alive) setPhase("error");
      });
    return () => {
      alive = false;
    };
  }, [id, owner]);

  useEffect(() => load(), [load]);

  const send = async () => {
    setSending(true);
    try {
      await api.scheduling.sendInvoice(id, owner);
      toast.success(
        invoice
          ? `Invoice sent to ${recipientLabel(invoice)}.`
          : "Invoice sent.",
      );
    } catch (err) {
      toast.error(decodeError(err).message);
    } finally {
      setSending(false);
    }
  };

  const status = invoice ? invoiceStatus(invoice) : null;
  const canSend =
    status === "draft" || status === "sent" || status === "overdue";
  // Design: paid → Share + Download PDF; void → Share; refunded → Share + Download PDF.
  const canShare = status === "paid" || status === "void" || status === "refunded";
  const canDownload = status === "paid" || status === "refunded";

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Invoice", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Invoice link copied.");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <PaidFeatureGate feature="Invoices">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.push(BASE)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-app-text-secondary hover:bg-app-hover"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="text-[15px] font-bold text-app-text">Invoice</h1>
          <span className="min-w-8 text-right">
            {status && <InvoiceStatusPill status={status} />}
          </span>
        </div>

        {phase === "loading" && (
          <div className="flex flex-col gap-3">
            <ShimmerBlock className="h-28 rounded-2xl" />
            <ShimmerBlock className="h-40 rounded-2xl" />
            <ShimmerBlock className="h-40 rounded-2xl" />
          </div>
        )}

        {phase === "error" && (
          <ErrorState message="We couldn't load this invoice." onRetry={load} />
        )}

        {phase === "ready" && invoice && (
          <>
            <Body invoice={invoice} pillar={pillar} />
            <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-app-border bg-app-surface/95 py-3 backdrop-blur">
              {canSend && (
                <button
                  type="button"
                  onClick={send}
                  disabled={sending}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 text-[13.5px] font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  {sending
                    ? "Sending…"
                    : status === "draft"
                      ? "Send"
                      : "Resend"}
                </button>
              )}
              {canShare && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-app-border bg-app-surface text-[13.5px] font-bold text-app-text transition hover:bg-app-hover"
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share
                </button>
              )}
              {canDownload && (
                <button
                  type="button"
                  disabled
                  title="PDF download coming soon"
                  className="flex h-12 flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary-600 text-[13.5px] font-bold text-white opacity-50 shadow-sm"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download PDF
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </PaidFeatureGate>
  );
}

function Body({
  invoice,
  pillar,
}: {
  invoice: Invoice;
  pillar: "personal" | "home" | "business";
}) {
  const items: InvoiceLineItem[] = Array.isArray(invoice.line_items)
    ? invoice.line_items
    : [];
  const subtotalCents = lineItemsSubtotalCents(items);
  const totalCents = Number(invoice.total_cents) || 0;
  const adjustmentCents = totalCents - subtotalCents;
  const currency = invoice.currency || "USD";
  const events = timelineEvents(invoice);
  const note =
    str(invoice.note) ?? str(invoice.sender_note) ?? str(invoice.memo);
  const terms = str(invoice.terms) ?? str(invoice.payment_terms);
  const recipient = recipientLabel(invoice);
  const tk = pillarTokens(pillar);

  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[0.04em] text-app-text-muted">
        {invoiceNumber(invoice)}
        {str(invoice.created_at)
          ? ` · issued ${new Date(invoice.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : ""}
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tracking-tight tabular-nums text-app-text">
          {formatInvoiceAmount(invoice)}
        </span>
        <span className="text-[11.5px] font-medium text-app-text-muted">
          total · {currency.toUpperCase()}
        </span>
      </div>

      {/* From / To */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <PartyCard
          label="From"
          name="Your business"
          sub="Business"
          tone="business"
        />
        <PartyCard label="To" name={recipient} sub="Customer" tone="personal" />
      </div>

      {/* Line items */}
      <Section title="Line items" icon={List}>
        {items.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-4 text-center text-[12px] text-app-text-secondary">
            No itemized breakdown for this invoice.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
            <div className="grid grid-cols-[1fr_1.5rem_3.5rem_4rem] gap-2 border-b border-app-border bg-app-surface-raised px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.08em] text-app-text-muted">
              <span>Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Total</span>
            </div>
            {items.map((it, i) => {
              const qty = Number(it.quantity ?? 1) || 1;
              const total = lineItemAmountCents(it);
              const unit = qty > 0 ? Math.round(total / qty) : total;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1.5rem_3.5rem_4rem] items-center gap-2 border-b border-app-border px-3 py-2.5 text-[11.5px] last:border-b-0"
                >
                  <span className="truncate font-medium text-app-text">
                    {str(it.description) ?? "Item"}
                  </span>
                  <span className="text-center text-app-text-muted tabular-nums">
                    {qty}
                  </span>
                  <span className="text-right text-app-text-muted tabular-nums">
                    {formatCents(unit, currency)}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-app-text">
                    {formatCents(total, currency)}
                  </span>
                </div>
              );
            })}
            <div className="bg-app-surface-raised px-3 py-2.5">
              <Row
                label="Subtotal"
                value={formatCents(subtotalCents, currency)}
              />
              {adjustmentCents !== 0 && (
                <Row
                  label="Adjustments"
                  value={formatCents(adjustmentCents, currency)}
                />
              )}
              <div className="my-1.5 h-px bg-app-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-bold text-app-text">
                  Total
                </span>
                <span
                  className={clsx(
                    "text-[15px] font-extrabold tabular-nums",
                    tk.text,
                  )}
                >
                  {formatCents(totalCents, currency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Timeline */}
      {events.length > 0 && (
        <Section title="Timeline" icon={Activity}>
          <div className="rounded-xl border border-app-border bg-app-surface p-3.5">
            {events.map((e, i) => (
              <div
                key={e.key}
                className={clsx(
                  "relative flex gap-2.5",
                  i !== events.length - 1 && "pb-3",
                )}
              >
                {i !== events.length - 1 && (
                  <span className="absolute left-[6px] top-3.5 bottom-0 w-px bg-app-border" />
                )}
                <span className="z-[1] mt-1 h-3 w-3 shrink-0 rounded-full bg-app-success" />
                <div className="flex flex-1 items-baseline justify-between">
                  <span className="text-[12px] font-semibold text-app-text">
                    {e.label}
                  </span>
                  <span className="font-mono text-[10px] text-app-text-muted">
                    {e.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Linked booking — only when the invoice references one */}
      {str(invoice.booking_id) && (
        <Section title="Booking" icon={Calendar}>
          <Link
            href={`/app/scheduling/bookings/${encodeURIComponent(String(invoice.booking_id))}`}
            className="flex w-full items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-left transition hover:bg-app-hover"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-business-bg text-app-business">
              <Calendar className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[12px] font-semibold text-app-text">
              View linked booking
            </span>
            <ChevronRight className="h-4 w-4 text-app-text-muted" aria-hidden />
          </Link>
        </Section>
      )}

      {terms && (
        <Section title="Payment terms" icon={FileText}>
          <p className="text-[11.5px] leading-4 text-app-text-secondary">
            {terms}
          </p>
        </Section>
      )}

      {note && (
        <Section title="Note from sender" icon={FileText}>
          <p className="rounded-lg border border-app-border bg-app-surface-raised px-3 py-2.5 text-[11.5px] italic leading-4 text-app-text-secondary">
            “{note}”
          </p>
        </Section>
      )}
    </div>
  );
}

function PartyCard({
  label,
  name,
  sub,
  tone,
}: {
  label: string;
  name: string;
  sub: string;
  tone: "personal" | "business";
}) {
  const tk = pillarTokens(tone);
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-3">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-app-text-muted">
        {label}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-app-surface-sunken text-[9px] font-bold text-app-text-secondary"
          aria-hidden
        >
          {initialsFor(name)}
        </span>
        <span className="truncate text-[12.5px] font-bold text-app-text">
          {name}
        </span>
      </div>
      <span
        className={clsx(
          "mt-1.5 flex items-center gap-1 text-[9.5px] font-semibold",
          tk.text,
        )}
      >
        <span className={clsx("h-1.5 w-1.5 rounded-full", tk.bg)} aria-hidden />
        {sub}
      </span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof List;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-app-text-muted" aria-hidden />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.08em] text-app-text-muted">
          {title}
        </span>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-[11px] font-medium text-app-text-secondary">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
