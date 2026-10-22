'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ChevronRight, FileText } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { BusinessInvoice } from '@pantopus/api';
import { chosenUsername } from '@pantopus/utils';

// Invoices that businesses sent you. The notification is the only other way to an invoice, so this list is where a
// household comes back to pay one. The server leaves out void invoices and answers at most 50 a page; a household
// has a handful, so every page is read and the unpaid ones go first.
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const UNPAID = new Set(['sent', 'viewed', 'overdue']);

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// A due date is a calendar day stored as midnight UTC, so it is shown in UTC to keep the day the business chose.
function dueDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Past due once the due day has ended where the household is. */
function isOverdue(invoice: BusinessInvoice): boolean {
  if (invoice.status === 'overdue') return true;
  if (!invoice.due_date) return false;
  const due = new Date(invoice.due_date);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) < today;
}

function businessName(invoice: BusinessInvoice): string {
  return invoice.business?.name?.trim() || chosenUsername(invoice.business?.username) || 'Business';
}

async function loadReceivedInvoices(): Promise<BusinessInvoice[]> {
  const byId = new Map<string, BusinessInvoice>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await api.businesses.getReceivedInvoices({ page, page_size: PAGE_SIZE });
    const invoices = result.invoices || [];
    invoices.forEach((invoice) => byId.set(invoice.id, invoice));
    if (invoices.length < PAGE_SIZE || byId.size >= (result.pagination?.total ?? 0)) break;
  }
  return [...byId.values()];
}

function InvoiceRow({ invoice }: { invoice: BusinessInvoice }) {
  const unpaid = UNPAID.has(invoice.status);
  const overdue = unpaid && isOverdue(invoice);
  const unopened = invoice.status === 'sent';
  let detail: string;
  if (!unpaid) detail = invoice.paid_at ? `Paid ${shortDay(invoice.paid_at)}` : 'Paid';
  else if (overdue) detail = invoice.due_date ? `Overdue · was due ${dueDay(invoice.due_date)}` : 'Overdue';
  else if (invoice.due_date) detail = `Due ${dueDay(invoice.due_date)}`;
  else detail = `Sent ${shortDay(invoice.created_at)}`;
  const badge = !unpaid
    ? { label: 'Paid', className: 'bg-green-100 text-green-700' }
    : overdue
      ? { label: 'Overdue', className: 'bg-red-100 text-red-700' }
      : { label: 'Unpaid', className: 'bg-amber-100 text-amber-700' };

  return (
    <Link
      href={`/app/invoice/${invoice.id}`}
      data-testid={`receivedInvoice-${invoice.id}`}
      className={`flex items-center gap-3 rounded-xl border p-4 transition hover:bg-app-hover ${
        unopened ? 'border-primary-200 bg-primary-50' : 'border-app-border bg-app-surface'
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-business-bg text-app-business" aria-hidden>
        <FileText className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-app-text">
          {unopened && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-hidden />}
          <span className="truncate">{businessName(invoice)}</span>
          {unopened && <span className="sr-only">(new)</span>}
        </p>
        <p className="text-xs text-app-text-secondary mt-0.5">{detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-app-text">{formatCents(invoice.total_cents)}</p>
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-app-text-muted" aria-hidden />
    </Link>
  );
}

function Section({ title, invoices }: { title: string; invoices: BusinessInvoice[] }) {
  if (invoices.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-wide text-app-text-secondary mb-2">
        {title} · {invoices.length}
      </h2>
      <div className="space-y-2">
        {invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} />)}
      </div>
    </section>
  );
}

function InvoicesContent() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<BusinessInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const load = useCallback(() => {
    setError(null);
    loadReceivedInvoices()
      .then(setInvoices)
      .catch((e: unknown) => setError(e instanceof Error && e.message ? e.message : "Couldn't load your invoices."));
  }, []);

  useEffect(() => { load(); }, [load]);

  const unpaid = (invoices || []).filter((invoice) => UNPAID.has(invoice.status));
  // Overdue first, then the newest; paid ones stay newest first.
  unpaid.sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)));
  const paid = (invoices || []).filter((invoice) => !UNPAID.has(invoice.status));
  const owed = unpaid.reduce((sum, invoice) => sum + (invoice.total_cents || 0), 0);
  const overdueCount = unpaid.filter(isOverdue).length;

  let body: React.ReactNode;
  if (error && !invoices) {
    body = (
      <div className="text-center py-16" role="alert">
        <AlertCircle className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
        <p className="text-sm text-app-text-secondary">{error}</p>
        <button onClick={load} className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
          Try again
        </button>
      </div>
    );
  } else if (!invoices) {
    body = (
      <div className="flex items-center justify-center min-h-[40vh]" aria-label="Loading invoices">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  } else if (invoices.length === 0) {
    body = (
      <div className="text-center py-16">
        <FileText className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
        <p className="text-sm font-semibold text-app-text">No invoices yet</p>
        <p className="text-sm text-app-text-secondary mt-1">
          When a business you hire on Pantopus sends you an invoice, it shows up here so you can pay it.
        </p>
      </div>
    );
  } else {
    body = (
      <>
        {unpaid.length > 0 && (
          <div className={`rounded-xl border p-4 mb-6 ${overdueCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-primary-200 bg-primary-50'}`}>
            <p className={`text-base font-bold ${overdueCount > 0 ? 'text-amber-800' : 'text-primary-800'}`}>{formatCents(owed)} to pay</p>
            <p className={`text-sm ${overdueCount > 0 ? 'text-amber-700' : 'text-primary-700'}`}>
              {unpaid.length === 1 ? '1 invoice' : `${unpaid.length} invoices`}
              {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''} · open one to pay by card
            </p>
          </div>
        )}
        <Section title="To pay" invoices={unpaid} />
        <Section title="Paid" invoices={paid} />
      </>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button aria-label="Back" onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Invoices</h1>
      </div>
      {body}
    </div>
  );
}

export default function InvoicesPage() { return <Suspense><InvoicesContent /></Suspense>; }
