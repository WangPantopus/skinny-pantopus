'use client';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  sent:    { bg: 'bg-blue-100',   color: 'text-blue-700',   label: 'Payment Requested' },
  viewed:  { bg: 'bg-indigo-100', color: 'text-indigo-700', label: 'Viewed' },
  paid:    { bg: 'bg-green-100',  color: 'text-green-700',  label: 'Paid' },
  void:    { bg: 'bg-red-100',    color: 'text-red-700',    label: 'Voided' },
  overdue: { bg: 'bg-amber-100',  color: 'text-amber-700',  label: 'Overdue' },
};

function InvoiceContent() {
  const router = useRouter();
  const { id: invoiceId } = useParams<{ id: string }>();

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);
    api.businesses.getReceivedInvoice(invoiceId)
      .then((result) => setInvoice(result.invoice))
      .catch((e: any) => setError(e?.message || 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const handlePay = async () => {
    if (!invoice) return;
    setPaying(true);
    try {
      const result = await api.businesses.payInvoice(invoice.id);
      await api.businesses.confirmInvoicePayment(invoice.id);
      setInvoice({ ...invoice, status: 'paid', paid_at: new Date().toISOString() });
      toast.success(`Payment of ${formatCents(result.amount_cents)} processed`);
    } catch (e: any) {
      toast.error(e?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const canPay = invoice && ['sent', 'viewed', 'overdue'].includes(invoice.status);
  const sc = invoice ? (STATUS_BADGE[invoice.status] || STATUS_BADGE.sent) : STATUS_BADGE.sent;

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Invoice</h1>
        </div>
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">{error || 'Invoice not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Invoice</h1>
      </div>

      {/* Invoice header */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <p className="text-xs text-app-text-muted mb-1">From</p>
        <p className="text-base font-semibold text-app-text">{invoice.business?.name || invoice.business?.username || 'Business'}</p>

        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="text-xs text-app-text-muted">Amount Due</p>
            <p className="text-3xl font-extrabold text-app-text">{formatCents(invoice.total_cents)}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sc.bg} ${sc.color}`}>{sc.label}</span>
        </div>

        {invoice.due_date && (
          <p className="text-sm text-app-text-secondary mt-2">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
        )}
      </div>

      {/* Line items */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-app-text-strong mb-3">Details</h2>
        <div className="divide-y divide-app-border-subtle">
          {(invoice.line_items || []).map((li: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-app-text">{li.description}</p>
                {li.quantity > 1 && (
                  <p className="text-xs text-app-text-muted">{formatCents(li.amount_cents)} &times; {li.quantity}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-app-text ml-3">{formatCents(li.amount_cents * (li.quantity || 1))}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-app-border">
          <span className="text-sm font-bold text-app-text">Total</span>
          <span className="text-sm font-bold text-app-text">{formatCents(invoice.total_cents)}</span>
        </div>
      </div>

      {/* Memo */}
      {invoice.memo && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
          <p className="text-xs text-app-text-muted mb-1">Note</p>
          <p className="text-sm text-app-text-secondary">{invoice.memo}</p>
        </div>
      )}

      {/* Pay button */}
      {canPay && (
        <button onClick={handlePay} disabled={paying}
          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 transition mb-4">
          {paying ? 'Processing...' : `Pay ${formatCents(invoice.total_cents)}`}
        </button>
      )}

      {/* Paid banner */}
      {invoice.status === 'paid' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Invoice Paid</p>
            {invoice.paid_at && <p className="text-xs text-green-600">Paid on {new Date(invoice.paid_at).toLocaleDateString()}</p>}
          </div>
        </div>
      )}

      {/* Voided banner */}
      {invoice.status === 'void' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-800">This invoice has been voided</p>
        </div>
      )}
    </div>
  );
}

export default function InvoicePage() { return <Suspense><InvoiceContent /></Suspense>; }
