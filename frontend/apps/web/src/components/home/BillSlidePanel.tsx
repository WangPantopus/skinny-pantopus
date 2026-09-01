'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Home, Landmark, Zap, Flame, Droplets, Pipette, Trash2, Satellite, Tv, Building2, ShieldCheck, Package, CreditCard } from 'lucide-react';
import SlidePanel from './SlidePanel';
import FileUpload from '@/components/FileUpload';

const BILL_TYPES: { value: string; label: string; icon: ReactNode }[] = [
  { value: 'rent', label: 'Rent', icon: <Home className="w-4 h-4" /> },
  { value: 'mortgage', label: 'Mortgage', icon: <Landmark className="w-4 h-4" /> },
  { value: 'electric', label: 'Electric', icon: <Zap className="w-4 h-4" /> },
  { value: 'gas', label: 'Gas', icon: <Flame className="w-4 h-4" /> },
  { value: 'water', label: 'Water', icon: <Droplets className="w-4 h-4" /> },
  { value: 'sewer', label: 'Sewer', icon: <Pipette className="w-4 h-4" /> },
  { value: 'trash', label: 'Trash', icon: <Trash2 className="w-4 h-4" /> },
  { value: 'internet', label: 'Internet', icon: <Satellite className="w-4 h-4" /> },
  { value: 'cable', label: 'Cable', icon: <Tv className="w-4 h-4" /> },
  { value: 'hoa', label: 'HOA', icon: <Building2 className="w-4 h-4" /> },
  { value: 'insurance', label: 'Insurance', icon: <ShieldCheck className="w-4 h-4" /> },
  { value: 'subscription', label: 'Subscription', icon: <Package className="w-4 h-4" /> },
  { value: 'other', label: 'Other', icon: <CreditCard className="w-4 h-4" /> },
];

const STATUSES = [
  { value: 'due', label: 'Due' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'canceled', label: 'Canceled' },
];

export default function BillSlidePanel({
  open,
  onClose,
  onSave,
  bill,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  bill?: Record<string, any>; // null = create, object = edit
}) {
  const isEdit = !!bill;

  const [billType, setBillType] = useState('other');
  const [providerName, setProviderName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [status, setStatus] = useState('due');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  useEffect(() => {
    if (bill) {
      setBillType(bill.bill_type || 'other');
      setProviderName(bill.provider_name || '');
      setAmount(bill.amount ? String(bill.amount) : '');
      setDueDate(bill.due_date ? bill.due_date.split('T')[0] : '');
      setPeriodStart(bill.period_start ? bill.period_start.split('T')[0] : '');
      setPeriodEnd(bill.period_end ? bill.period_end.split('T')[0] : '');
      setStatus(bill.status || 'due');
      setMediaFiles([]);
    } else {
      setBillType('other');
      setProviderName('');
      setAmount('');
      setDueDate('');
      setPeriodStart('');
      setPeriodEnd('');
      setStatus('due');
      setMediaFiles([]);
    }
    setError('');
  }, [bill, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Amount is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        bill_type: billType,
        provider_name: providerName.trim() || undefined,
        amount: parseFloat(amount),
        due_date: dueDate || undefined,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
        _mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
      };
      if (isEdit) {
        payload.status = status;
      }
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Bill' : 'Add Bill'}
      subtitle={isEdit ? (bill?.provider_name || bill?.bill_type) : 'Track a household bill'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Bill Type */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {BILL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setBillType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  billType === t.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border'
                }`}
              >
                <span className="flex items-center gap-1">{t.icon} {t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Provider Name */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Provider Name</label>
          <input
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g., PGE, Comcast, etc."
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={200}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Amount ($) *</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Billing Period */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Attachments (optional) */}
        <FileUpload
          label="Bill / Receipt (optional)"
          accept={['image', 'document']}
          maxFiles={5}
          maxSize={100 * 1024 * 1024}
          files={mediaFiles}
          onFilesSelected={setMediaFiles}
          helperText="Upload a photo or PDF of the bill."
          compact
        />

        {/* Status (edit only) */}
        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Status</label>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                    status === s.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-app-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !amount}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Bill' : 'Add Bill'}
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}
