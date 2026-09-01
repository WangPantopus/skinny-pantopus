'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import Field from '../shared/Field';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  staff: 'Staff',
  viewer: 'Viewer',
};

interface InviteSeatModalProps {
  open: boolean;
  onClose: () => void;
  businessId: string;
  onSuccess: () => void;
}

export default function InviteSeatModal({ open, onClose, businessId, onSuccess }: InviteSeatModalProps) {
  const [form, setForm] = useState({
    display_name: '',
    invited_email: '',
    role_base: 'viewer',
    title: '',
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      const result = await api.businessSeats.createSeatInvite(businessId, {
        display_name: form.display_name.trim(),
        invite_email: form.invited_email.trim() || undefined,
        role_base: form.role_base as 'admin' | 'editor' | 'staff' | 'viewer',
        title: form.title.trim() || undefined,
      });
      toast.success('Seat created! Share the invite link with the team member.');
      // Copy invite token to clipboard if available
      if (result.invite_token) {
        try {
          const inviteUrl = `${window.location.origin}/invite/seat?token=${result.invite_token}`;
          await navigator.clipboard.writeText(inviteUrl);
          toast.info('Invite link copied to clipboard');
        } catch {
          // clipboard may not be available
        }
      }
      setForm({ display_name: '', invited_email: '', role_base: 'viewer', title: '' });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create seat invite';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-app">
            <h3 className="text-lg font-semibold text-app">Create Seat & Invite</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-raised transition">
              <X className="w-5 h-5 text-app-secondary" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-app-secondary">
              Create a new business seat. The seat acts as the team member&apos;s identity within this business — their personal account stays private.
            </p>

            <Field
              label="Display Name *"
              value={form.display_name}
              onChange={(v) => setForm({ ...form, display_name: v })}
              placeholder="e.g. Front Desk"
            />

            <Field
              label="Email (optional)"
              value={form.invited_email}
              onChange={(v) => setForm({ ...form, invited_email: v })}
              placeholder="team@example.com"
              type="email"
            />

            <div>
              <label className="block text-sm font-medium text-app-strong mb-1">Role</label>
              <select
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

            <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3">
              <p className="text-xs text-violet-700">
                <strong>Privacy note:</strong> Once the seat is created, an invite link will be generated. The invited person binds to the seat — their personal identity is never revealed to the business.
              </p>
            </div>
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
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition"
            >
              {saving ? 'Creating…' : 'Create seat'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
