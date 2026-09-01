'use client';

import { useState } from 'react';
import * as api from '@pantopus/api';
import SlidePanel from '../SlidePanel';

const LOCKDOWN_EFFECTS = [
  { icon: '❌', text: 'Revokes all active guest passes', detail: 'Existing share links stop working immediately' },
  { icon: '🔒', text: 'Hides sensitive data from non-admins', detail: 'Access codes, financial data, and documents become hidden' },
  { icon: '🚫', text: 'Blocks new member invitations', detail: 'No one can be invited until lockdown is lifted' },
  { icon: '🔑', text: 'Forces re-authentication', detail: 'All members must sign in again to verify identity' },
  { icon: '📋', text: 'Logs all activity with elevated detail', detail: 'Every action is recorded in the audit log' },
];

export default function LockdownPanel({
  open,
  onClose,
  homeId,
  lockdownEnabled,
  onLockdownChange,
}: {
  open: boolean;
  onClose: () => void;
  homeId: string;
  lockdownEnabled: boolean;
  onLockdownChange: (enabled: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ message: string; passesRevoked?: number } | null>(null);

  const handleEnable = async () => {
    if (confirmText !== 'LOCKDOWN') return;
    setToggling(true);
    setError('');
    try {
      const res = await api.homeProfile.enableLockdown(homeId);
      onLockdownChange(true);
      setResult({ message: 'Lockdown enabled', passesRevoked: res.guest_passes_revoked });
      setShowConfirm(false);
      setConfirmText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to enable lockdown');
    }
    setToggling(false);
  };

  const handleDisable = async () => {
    setToggling(true);
    setError('');
    try {
      await api.homeProfile.disableLockdown(homeId);
      onLockdownChange(false);
      setResult({ message: 'Lockdown disabled' });
      setShowConfirm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disable lockdown');
    }
    setToggling(false);
  };

  return (
    <SlidePanel open={open} onClose={onClose} title="Lockdown Mode" subtitle="Emergency security control">
      <div className="space-y-5">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {result && (
          <div className={`text-sm rounded-lg px-3 py-2 ${
            result.message.includes('enabled')
              ? 'text-red-700 bg-red-50'
              : 'text-green-700 bg-green-50'
          }`}>
            {result.message}
            {result.passesRevoked !== undefined && result.passesRevoked > 0 && (
              <span className="block text-[10px] mt-0.5">
                {result.passesRevoked} guest pass{result.passesRevoked !== 1 ? 'es' : ''} revoked
              </span>
            )}
          </div>
        )}

        {/* Current Status */}
        <div className={`rounded-xl border p-5 text-center ${
          lockdownEnabled
            ? 'bg-red-50/50 border-red-200'
            : 'bg-green-50/50 border-green-200'
        }`}>
          <div className="text-4xl mb-2">{lockdownEnabled ? '🔒' : '🛡️'}</div>
          <div className={`text-lg font-bold ${lockdownEnabled ? 'text-red-700' : 'text-green-700'}`}>
            {lockdownEnabled ? 'LOCKDOWN ACTIVE' : 'Lockdown Disabled'}
          </div>
          <p className="text-xs text-app-text-secondary mt-1">
            {lockdownEnabled
              ? 'Your home is in emergency lockdown mode'
              : 'Your home is operating normally'}
          </p>
        </div>

        {/* What lockdown does */}
        <div>
          <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider mb-3">
            What Lockdown Does
          </h4>
          <div className="space-y-2">
            {LOCKDOWN_EFFECTS.map((effect, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${
                  lockdownEnabled ? 'bg-red-50/50' : 'bg-app-surface-raised'
                }`}
              >
                <span className="text-sm flex-shrink-0 mt-0.5">{effect.icon}</span>
                <div>
                  <div className={`text-sm font-medium ${lockdownEnabled ? 'text-red-800' : 'text-app-text-strong'}`}>
                    {effect.text}
                  </div>
                  <div className="text-[10px] text-app-text-muted mt-0.5">{effect.detail}</div>
                </div>
                {lockdownEnabled && (
                  <span className="text-[10px] text-red-500 font-medium flex-shrink-0 mt-0.5">Active</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        {!lockdownEnabled ? (
          <div className="space-y-3">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition"
              >
                Enable Lockdown
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-800">
                  Are you sure you want to enable lockdown?
                </p>
                <p className="text-xs text-red-600">
                  This will immediately revoke all guest passes, hide sensitive data from non-admins,
                  and block new invitations. All members will need to re-authenticate.
                </p>
                <div>
                  <label className="block text-[10px] text-red-600 mb-1">Type LOCKDOWN to confirm</label>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono"
                    placeholder="LOCKDOWN"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleEnable}
                    disabled={toggling || confirmText !== 'LOCKDOWN'}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {toggling ? 'Enabling...' : 'Confirm Lockdown'}
                  </button>
                  <button
                    onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                    className="flex-1 py-2.5 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleDisable}
              disabled={toggling}
              className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition"
            >
              {toggling ? 'Disabling...' : 'Disable Lockdown'}
            </button>
            <p className="text-[10px] text-app-text-muted text-center">
              Disabling lockdown restores normal operations. Previously revoked guest passes
              will NOT be automatically restored — you&apos;ll need to create new ones.
            </p>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
