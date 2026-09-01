'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, X, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import type { BusinessInvoice, InvoiceLineItem } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  viewed: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  paid: { bg: 'bg-green-100', text: 'text-green-700' },
  void: { bg: 'bg-red-100', text: 'text-red-600' },
  overdue: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const FILTER_OPTIONS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'void', label: 'Void' },
];

interface Props {
  businessId: string;
}

export default function InvoicesTab({ businessId }: Props) {
  const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [recipientId, setRecipientId] = useState('');
  const [memo, setMemo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [lineItems, setLineItems] = useState([{ description: '', amount: '', quantity: '1' }]);
  const [creating, setCreating] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.businesses.getBusinessInvoices(businessId, {
        page: 1,
        page_size: 50,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setInvoices(result.invoices || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, statusFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const handleVoid = async (invoiceId: string) => {
    const ok = await confirmStore.open({
      title: 'Void Invoice',
      description: 'Are you sure? This cannot be undone.',
      confirmLabel: 'Void',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.businesses.voidBusinessInvoice(businessId, invoiceId);
      loadInvoices();
      toast.success('Invoice voided');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to void invoice');
    }
  };

  const handleCreate = async () => {
    if (!recipientId.trim()) { toast.error('Recipient user ID is required'); return; }
    const parsedItems: InvoiceLineItem[] = [];
    for (const item of lineItems) {
      if (!item.description.trim() || !item.amount.trim()) continue;
      const amount_cents = Math.round(parseFloat(item.amount) * 100);
      if (isNaN(amount_cents) || amount_cents <= 0) { toast.error(`Invalid amount: ${item.amount}`); return; }
      parsedItems.push({ description: item.description.trim(), amount_cents, quantity: parseInt(item.quantity) || 1 });
    }
    if (parsedItems.length === 0) { toast.error('At least one line item is required'); return; }

    setCreating(true);
    try {
      await api.businesses.createBusinessInvoice(businessId, {
        recipient_user_id: recipientId.trim(),
        line_items: parsedItems,
        due_date: dueDate.trim() || null,
        memo: memo.trim() || null,
      });
      setShowCreate(false);
      setRecipientId(''); setMemo(''); setDueDate('');
      setLineItems([{ description: '', amount: '', quantity: '1' }]);
      loadInvoices();
      toast.success('Invoice created');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-app-text">Invoices</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {FILTER_OPTIONS.map(opt => (
          <button key={opt.label} onClick={() => setStatusFilter(opt.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
              statusFilter === opt.key
                ? 'bg-violet-600 text-white'
                : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">{statusFilter ? `No ${statusFilter} invoices` : 'No invoices yet'}</p>
          <p className="text-xs text-app-text-muted mt-1">Create an invoice to bill a customer after service delivery.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const sc = STATUS_COLORS[inv.status] || STATUS_COLORS.draft;
            return (
              <div key={inv.id} className="bg-app-surface border border-app-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app-text truncate">{(inv as any).recipient?.name || (inv as any).recipient?.username || 'Unknown'}</p>
                    <p className="text-xs text-app-text-secondary mt-0.5">
                      {new Date(inv.created_at).toLocaleDateString()}
                      {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-app-text">{formatCents(inv.total_cents)}</p>
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${sc.bg} ${sc.text}`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {inv.memo && <p className="text-xs text-app-text-secondary italic mt-2">{inv.memo}</p>}

                {/* Line items */}
                <div className="mt-3 pt-3 border-t border-app-border-subtle space-y-1">
                  {(inv.line_items || []).map((li: InvoiceLineItem, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-app-text-secondary">{li.description}{(li.quantity || 1) > 1 ? ` ×${li.quantity}` : ''}</span>
                      <span className="text-app-text-secondary">{formatCents(li.amount_cents * (li.quantity || 1))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs text-app-text-muted pt-1">
                    <span>Platform fee</span>
                    <span>{formatCents(inv.fee_cents)}</span>
                  </div>
                </div>

                {['sent', 'viewed', 'overdue'].includes(inv.status) && (
                  <button onClick={() => handleVoid(inv.id)} className="text-xs text-red-600 font-medium mt-3 hover:underline">
                    Void Invoice
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-app-border-subtle">
              <h3 className="text-base font-semibold text-app-text">New Invoice</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 text-app-text-muted hover:text-app-text-secondary"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-xs text-app-text-secondary mb-1 block">Recipient User ID</label>
                <input type="text" value={recipientId} onChange={e => setRecipientId(e.target.value)} placeholder="Paste user ID"
                  className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500" />
              </div>

              <div>
                <label className="text-xs text-app-text-secondary mb-1 block">Line Items</label>
                {lineItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input type="text" value={item.description} onChange={e => updateLineItem(i, 'description', e.target.value)} placeholder="Description"
                      className="flex-[2] text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500" />
                    <input type="text" value={item.amount} onChange={e => updateLineItem(i, 'amount', e.target.value)} placeholder="$0.00"
                      className="flex-1 text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500" />
                    <input type="text" value={item.quantity} onChange={e => updateLineItem(i, 'quantity', e.target.value)} placeholder="1"
                      className="w-12 text-sm px-2 py-2 border border-app-border rounded-lg bg-app-surface text-app-text text-center focus:outline-none focus:ring-1 focus:ring-violet-500" />
                    {lineItems.length > 1 && (
                      <button onClick={() => setLineItems(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setLineItems(prev => [...prev, { description: '', amount: '', quantity: '1' }])}
                  className="flex items-center gap-1 text-xs text-violet-600 font-medium hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Add line item
                </button>
              </div>

              <div>
                <label className="text-xs text-app-text-secondary mb-1 block">Due Date (optional)</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-violet-500" />
              </div>

              <div>
                <label className="text-xs text-app-text-secondary mb-1 block">Memo (optional)</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="Note to recipient..." rows={3}
                  className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-app-border-subtle">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-app-text-secondary hover:bg-app-hover rounded-lg transition">Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                className="px-5 py-2 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition">
                {creating ? 'Sending...' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
