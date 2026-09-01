// W15 — Invoices. Framework-free helpers for the owner invoice list (G12) and
// detail (G13). The backend `GET /invoices` guarantees only
// { id, business_user_id, recipient_user_id, total_cents, currency,
//   line_items?, created_at } (it's a gig-system reuse, so extra fields may
// ride along under the index signature). These accessors read what's there and
// degrade gracefully — never inventing a status or payer the API didn't send.

import type {
  Invoice,
  SchedulingInvoiceLineItem as InvoiceLineItem,
} from "@pantopus/types";
import { formatCents } from "@/components/scheduling/packages/money";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partial"
  | "overdue"
  | "void"
  | "refunded";

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; cls: string }
> = {
  draft: { label: "Draft", cls: "bg-app-surface-muted text-app-text-muted" },
  sent: { label: "Sent", cls: "bg-app-info-bg text-app-info" },
  paid: { label: "Paid", cls: "bg-app-success-bg text-app-success" },
  partial: { label: "Deposit paid", cls: "bg-app-warning-bg text-app-warning" },
  overdue: { label: "Overdue", cls: "bg-app-warning-bg text-app-warning" },
  void: { label: "Void", cls: "bg-app-surface-muted text-app-text-muted" },
  refunded: {
    label: "Refunded",
    cls: "bg-app-business-bg text-app-business",
  },
};

const KNOWN_STATUSES = Object.keys(INVOICE_STATUS_META) as InvoiceStatus[];

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/**
 * Best-effort status. Prefers an explicit `status`, then infers from lifecycle
 * timestamps, then falls back to "sent" (invoices originate from a real booking
 * or package sale, so they've at minimum been issued).
 */
export function invoiceStatus(inv: Invoice): InvoiceStatus {
  const raw = str(inv.status)?.toLowerCase();
  if (raw && (KNOWN_STATUSES as string[]).includes(raw)) {
    return raw as InvoiceStatus;
  }
  if (raw === "partially_paid" || raw === "deposit_paid") return "partial";
  if (raw === "canceled") return "void";
  if (inv.refunded_at) return "refunded";
  if (inv.voided_at) return "void";
  if (inv.paid_at) return "paid";
  if (inv.deposit_paid_at) return "partial";
  if (inv.sent_at) return "sent";
  return "sent";
}

/** A stable, human invoice number — the backend's if present, else from the id. */
export function invoiceNumber(inv: Invoice): string {
  const explicit = str(inv.number) ?? str(inv.invoice_number);
  if (explicit) return explicit.toUpperCase();
  const tail = String(inv.id).replace(/-/g, "").slice(-6).toUpperCase();
  return `INV-${tail}`;
}

/** Display name for the recipient, degrading to a generic label. */
export function recipientLabel(inv: Invoice): string {
  const recipient = obj(inv.recipient);
  return (
    str(inv.recipient_name) ??
    str(recipient?.name) ??
    str(recipient?.first_name) ??
    str(inv.payer_name) ??
    "Customer"
  );
}

export function initialsFor(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Short service/description line, from the first line item when available. */
export function invoiceServiceLabel(inv: Invoice): string | null {
  const items = Array.isArray(inv.line_items) ? inv.line_items : [];
  if (items.length === 1) return str(items[0]?.description);
  if (items.length > 1) {
    const first = str(items[0]?.description);
    return first
      ? `${first} +${items.length - 1} more`
      : `${items.length} items`;
  }
  return str(inv.service) ?? str(inv.description);
}

export function lineItemAmountCents(item: InvoiceLineItem): number {
  const amt = Number(item.amount_cents) || 0;
  const qty = item.quantity == null ? 1 : Number(item.quantity) || 1;
  return amt * qty;
}

export function lineItemsSubtotalCents(items: InvoiceLineItem[]): number {
  return items.reduce((sum, it) => sum + lineItemAmountCents(it), 0);
}

export function formatInvoiceAmount(inv: Invoice): string {
  return formatCents(inv.total_cents, inv.currency);
}

const OUTSTANDING: InvoiceStatus[] = ["draft", "sent", "partial", "overdue"];

/**
 * Outstanding (issued, not settled) vs collected-this-month. Only meaningful
 * when statuses are present; with no status signal everything reads as "sent",
 * so outstanding carries the full balance and collected is 0 — an honest view
 * of what the API actually exposes.
 */
export function summarizeInvoices(
  invoices: Invoice[],
  now: Date = new Date(),
): { outstandingCents: number; collectedCents: number; currency: string } {
  const month = now.getMonth();
  const year = now.getFullYear();
  let outstandingCents = 0;
  let collectedCents = 0;
  for (const inv of invoices) {
    const status = invoiceStatus(inv);
    const total = Number(inv.total_cents) || 0;
    if (OUTSTANDING.includes(status)) {
      outstandingCents += total;
    } else if (status === "paid") {
      const d = inv.created_at ? new Date(inv.created_at) : null;
      if (d && d.getMonth() === month && d.getFullYear() === year) {
        collectedCents += total;
      }
    }
  }
  const currency = str(invoices[0]?.currency) ?? "USD";
  return { outstandingCents, collectedCents, currency };
}

export const INVOICE_FILTERS: ReadonlyArray<{
  value: "all" | InvoiceStatus;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "sent", label: "Sent" },
  { value: "overdue", label: "Overdue" },
  { value: "refunded", label: "Refunded" },
];

export function filterInvoices(
  invoices: Invoice[],
  filter: "all" | InvoiceStatus,
): Invoice[] {
  if (filter === "all") return invoices;
  return invoices.filter((inv) => invoiceStatus(inv) === filter);
}

/** Free-text match across recipient, number, and service line. */
export function matchesQuery(inv: Invoice, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    recipientLabel(inv),
    invoiceNumber(inv),
    invoiceServiceLabel(inv) ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

/** "Today" / "Yesterday" / "Jun 11" header for an invoice's created date. */
export function dayLabel(
  iso: string | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface TimelineEvent {
  key: string;
  label: string;
  time: string;
}

function shortDate(iso: unknown): string | null {
  const s = str(iso);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Lifecycle events derived from whatever timestamps the invoice carries. Always
 * includes "Created"; the rest appear only when the backing field is present —
 * no invented history.
 */
export function timelineEvents(inv: Invoice): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const created = shortDate(inv.created_at);
  if (created) out.push({ key: "created", label: "Created", time: created });
  const sent = shortDate(inv.sent_at);
  if (sent) out.push({ key: "sent", label: "Sent", time: sent });
  const deposit = shortDate(inv.deposit_paid_at);
  if (deposit)
    out.push({ key: "deposit", label: "Deposit paid", time: deposit });
  const paid = shortDate(inv.paid_at);
  if (paid) out.push({ key: "paid", label: "Paid in full", time: paid });
  const refunded = shortDate(inv.refunded_at);
  if (refunded)
    out.push({ key: "refunded", label: "Refunded", time: refunded });
  const voided = shortDate(inv.voided_at);
  if (voided) out.push({ key: "voided", label: "Voided", time: voided });
  return out;
}

/** Group invoices into ordered day buckets, preserving input order within each. */
export function groupByDay(
  invoices: Invoice[],
  now: Date = new Date(),
): Array<{ label: string; items: Invoice[] }> {
  const order: string[] = [];
  const map = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    const label = dayLabel(inv.created_at, now);
    if (!map.has(label)) {
      map.set(label, []);
      order.push(label);
    }
    map.get(label)!.push(inv);
  }
  return order.map((label) => ({ label, items: map.get(label)! }));
}
