'use client';

import { useState, useEffect } from 'react';
import * as api from '@pantopus/api';
import QRCode from '../../ui/QRCode';

/**
 * ScopedShareModal — reusable modal for sharing a single resource
 * (document, event, etc.) via a scoped grant link.
 */
export default function ScopedShareModal({
  open,
  onClose,
  homeId,
  resourceType,
  resourceId,
  resourceLabel,
}: {
  open: boolean;
  onClose: () => void;
  homeId: string;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
}) {
  const [durationHours, setDurationHours] = useState('24');
  const [passcode, setPasscode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Result
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setDurationHours('24');
      setPasscode('');
      setCreating(false);
      setError('');
      setToken('');
      setCopied(false);
    }
  }, [open]);

  const getShareUrl = (t: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/shared/${encodeURIComponent(t)}`;
    }
    return `/shared/${encodeURIComponent(t)}`;
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await api.homeIam.createScopedGrant(homeId, {
        resource_type: resourceType,
        resource_id: resourceId,
        duration_hours: Number(durationHours) || 24,
        passcode: passcode.trim() || undefined,
        can_edit: false,
      });
      setToken(res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    }
    setCreating(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard not available
    }
  };

  const handleWebShare = async () => {
    const url = getShareUrl(token);
    if (navigator.share) {
      try {
        await navigator.share({
          title: resourceLabel || 'Shared Resource',
          text: `Here's a shared link`,
          url,
        });
      } catch {
        // User cancelled
      }
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
        <div
          className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-app-text">
                {token ? 'Share Link Ready' : 'Share Resource'}
              </h3>
              {resourceLabel && (
                <p className="text-xs text-app-text-secondary mt-0.5 truncate">{resourceLabel}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-app-hover rounded-lg transition text-app-text-secondary hover:text-app-text-strong"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

            {!token ? (
              <>
                {/* Configure */}
                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1">Link Duration</label>
                  <div className="flex gap-2">
                    {['1', '8', '24', '48', '168'].map((h) => (
                      <button
                        key={h}
                        onClick={() => setDurationHours(h)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          durationHours === h
                            ? 'bg-gray-900 text-white'
                            : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
                        }`}
                      >
                        {Number(h) < 24 ? `${h}h` : `${Number(h) / 24}d`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1">Passcode (optional)</label>
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full rounded-lg border border-app-border px-3 py-2 text-sm font-mono"
                    placeholder="Leave blank for no passcode"
                  />
                </div>

                <p className="text-xs text-app-text-secondary">Recipients can view this item. Editing is not included.</p>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    {creating ? 'Creating...' : 'Create Link'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Result */}
                <div className="bg-app-surface-raised rounded-xl p-3 space-y-2">
                  <label className="block text-[10px] font-medium text-app-text-secondary uppercase tracking-wider">Share Link</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-app-surface border border-app-border rounded-lg px-3 py-2 truncate select-all">
                      {getShareUrl(token)}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition flex-shrink-0"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* QR */}
                <div className="flex justify-center">
                  <div className="bg-app-surface rounded-xl border border-app-border p-3">
                    <QRCode value={getShareUrl(token)} size={160} label="Resource share QR code" />
                  </div>
                </div>

                {/* Share actions */}
                <div className="flex gap-3">
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={handleWebShare}
                      className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <span>📤</span>
                      Share
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="flex-1 py-2 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
                  >
                    Done
                  </button>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-3 text-[10px] text-app-text-muted justify-center">
                  <span>Expires in {durationHours}h</span>
                  {passcode && <span>· Passcode protected</span>}
                  <span>· View only</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
