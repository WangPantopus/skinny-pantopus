'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // After a create (or a renewal) the dialog shows the invite link. The link exists only now, and a
  // clipboard write after the request isn't allowed in Safari, so the person copies it themselves.
  const [created, setCreated] = useState<{ url: string | null; renewed: boolean } | null>(null);
  const titleId = useId();

  // The seat list refreshes once the link view closes: refreshing the dashboard re-renders the
  // tab, which would take the link away while it is still being copied.
  const close = useCallback(() => {
    if (created) onSuccess();
    setCreated(null);
    onClose();
  }, [created, onClose, onSuccess]);

  // Escape closes the dialog, as its close button does.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // On document.body: AppShell's <main> is its own stacking context (relative z-0), so from inside it the
  // backdrop could not cover the header and sidebar, which stayed clickable behind the dialog.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

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
      setCreated({
        url: result.invite_token ? `${window.location.origin}/invite/seat?token=${result.invite_token}` : null,
        // Inviting the same email again renews that invite; the link sent before stops working.
        renewed: result.renewed === true,
      });
      setForm({ display_name: '', invited_email: '', role_base: 'viewer', title: '' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create seat invite';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!created?.url) return;
    try {
      await navigator.clipboard.writeText(created.url);
      toast.success('Invite link copied');
    } catch {
      toast.info('Select the link and copy it');
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={close} />
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
            <h3 id={titleId} className="text-lg font-semibold text-app">
              {created ? (created.renewed ? 'Invite renewed' : 'Seat created') : 'Create Seat & Invite'}
            </h3>
            <button onClick={close} className="p-1 rounded-lg hover:bg-surface-raised transition" aria-label="Close">
              <X className="w-5 h-5 text-app-secondary" />
            </button>
          </div>

          {created ? (
            <div className="p-5 space-y-4">
              <p className="text-sm text-app-secondary">
                {created.renewed
                  ? 'The link you shared before no longer works. Send the team member this one.'
                  : 'Send this invite link to the team member. They join through the seat, and their personal account stays private.'}
              </p>
              {created.url && (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={created.url}
                    aria-label="Invite link"
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 rounded-lg border border-app-strong px-3 py-2 text-sm text-app"
                  />
                  <button
                    onClick={copyLink}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
                  >
                    Copy link
                  </button>
                </div>
              )}
            </div>
          ) : (
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
              <label htmlFor="seat-invite-role" className="block text-sm font-medium text-app-strong mb-1">Role</label>
              <select
                id="seat-invite-role"
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
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t border-app">
            {created ? (
              <button
                onClick={close}
                className="px-4 py-2 rounded-lg border border-app-strong text-sm font-medium text-app-strong hover:bg-surface-raised transition"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={close}
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
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
