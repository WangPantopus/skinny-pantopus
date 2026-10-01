'use client';

import { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import Field from '../shared/Field';
import type { SeatListItem } from '@pantopus/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  staff: 'Staff',
  viewer: 'Viewer',
};

interface EditSeatModalProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  seat: SeatListItem | null;
  onSuccess: () => void;
}

export default function EditSeatModal({ open, onClose, businessId, seat, onSuccess }: EditSeatModalProps) {
  const [form, setForm] = useState({ display_name: '', role_base: 'viewer', title: '' });
  const [saving, setSaving] = useState(false);
  const titleId = useId();

  // Escape closes the dialog, as its close button does.
  useEffect(() => {
    if (!open || !seat) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, seat, onClose]);

  useEffect(() => {
    if (seat) {
      setForm({
        display_name: seat.display_name || '',
        role_base: seat.role_base || 'viewer',
        title: seat.title || '',
      });
    }
  }, [seat]);

  // On document.body: AppShell's <main> is its own stacking context (relative z-0), so from inside it the
  // backdrop could not cover the header and sidebar, which stayed clickable behind the dialog.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !seat || !mounted) return null;

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      await api.businessSeats.updateSeat(businessId, seat.id, {
        display_name: form.display_name.trim(),
        role_base: form.role_base as 'admin' | 'editor' | 'staff' | 'viewer',
        title: form.title.trim() || undefined,
      });
      toast.success('Seat updated');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update seat';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-app">
            <h3 id={titleId} className="text-lg font-semibold text-app">Edit Seat</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-raised transition" aria-label="Close">
              <X className="w-5 h-5 text-app-secondary" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <Field
              label="Display Name *"
              value={form.display_name}
              onChange={(v) => setForm({ ...form, display_name: v })}
              placeholder="e.g. Front Desk"
            />

            <div>
              <label htmlFor="seat-edit-role" className="block text-sm font-medium text-app-strong mb-1">Role</label>
              <select
                id="seat-edit-role"
                value={form.role_base}
                onChange={(e) => setForm({ ...form, role_base: e.target.value })}
                className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <Field
              label="Title (optional)"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="e.g. Store Manager"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-app">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-app-strong text-sm font-medium text-app-strong hover:bg-surface-raised transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
