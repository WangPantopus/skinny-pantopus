'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { GuestPassView } from '@pantopus/api';

// ============================================================
// Guest View Page — /guest/:token
// Public-facing page for guest pass holders. No auth required.
// ============================================================

type PageState = 'loading' | 'passcode' | 'expired' | 'revoked' | 'error' | 'success';

export default function GuestViewPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<GuestPassView | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPass = useCallback(async (code?: string) => {
    try {
      const res = await api.homeGuest.viewGuestPass(token, code);
      setData(res);
      setState('success');
    } catch (err: unknown) {
      const error = err as { body?: { requiresPasscode?: boolean }; response?: unknown; message?: string };
      const body = error?.body || error;
      const msg = error?.message || '';

      if ((body as { requiresPasscode?: boolean })?.requiresPasscode || msg.includes('passcode')) {
        setState('passcode');
      } else if (msg.includes('expired') || msg.includes('Expired')) {
        setState('expired');
      } else if (msg.includes('revoked') || msg.includes('Revoked') || msg.includes('inactive')) {
        setState('revoked');
      } else {
        setState('error');
        setErrorMsg(msg || 'Something went wrong');
      }
    }
  }, [token]);

  useEffect(() => {
    loadPass();
  }, [loadPass]);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setPasscodeError('');
    setSubmitting(true);
    try {
      const res = await api.homeGuest.viewGuestPass(token, passcode.trim());
      setData(res);
      setState('success');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || '';
      if (msg.includes('passcode') || msg.includes('incorrect') || msg.includes('invalid')) {
        setPasscodeError('Incorrect passcode. Please try again.');
      } else if (msg.includes('expired')) {
        setState('expired');
      } else {
        setPasscodeError(msg || 'Failed to verify passcode');
      }
    }
    setSubmitting(false);
  };

  // ---- Loading state ----
  if (state === 'loading') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-pulse">🏠</div>
          <div className="w-8 h-8 border-2 border-app-border border-t-gray-700 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-app-text-secondary">Loading guest access...</p>
        </div>
      </PageShell>
    );
  }

  // ---- Passcode required state ----
  if (state === 'passcode') {
    return (
      <PageShell>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Passcode Required</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            Enter the passcode to view this guest access.
          </p>
          <form onSubmit={handlePasscodeSubmit} className="max-w-xs mx-auto space-y-3">
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              autoFocus
              className="w-full rounded-xl border border-app-border px-4 py-3 text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none"
              maxLength={20}
            />
            {passcodeError && (
              <p className="text-xs text-red-600">{passcodeError}</p>
            )}
            <button
              type="submit"
              disabled={!passcode.trim() || submitting}
              className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {submitting ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>
      </PageShell>
    );
  }

  // ---- Expired state ----
  if (state === 'expired') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Link Expired</h1>
          <p className="text-sm text-app-text-secondary mb-6 max-w-xs mx-auto">
            This guest access link has expired. Contact the home admin to request a new one.
          </p>
          <a
            href="mailto:?"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-app-border rounded-xl text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Request New Access
          </a>
        </div>
      </PageShell>
    );
  }

  // ---- Revoked state ----
  if (state === 'revoked') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Access Revoked</h1>
          <p className="text-sm text-app-text-secondary max-w-xs mx-auto">
            This guest access link is no longer active. It was revoked by the home admin.
          </p>
        </div>
      </PageShell>
    );
  }

  // ---- Error state ----
  if (state === 'error') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Something Went Wrong</h1>
          <p className="text-sm text-app-text-secondary mb-6 max-w-xs mx-auto">
            {errorMsg || 'We couldn\'t load this guest access. The link may be invalid.'}
          </p>
          <button
            onClick={() => { setState('loading'); loadPass(); }}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
          >
            Try Again
          </button>
        </div>
      </PageShell>
    );
  }

  // ---- Success state ----
  if (!data) return null;

  const { pass, sections } = data;

  return (
    <PageShell>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🏠</div>
        <h1 className="text-xl font-semibold text-app-text">
          {pass.custom_title || pass.home_name || 'Guest Access'}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted bg-app-surface-sunken px-2 py-0.5 rounded-full">
            Guest Access
          </span>
          {pass.kind && (
            <span className="text-[10px] font-medium text-app-text-muted bg-app-surface-sunken px-2 py-0.5 rounded-full capitalize">
              {pass.kind.replace('_', ' ')}
            </span>
          )}
        </div>
        {pass.expires_at && (
          <ExpiryCountdown expiresAt={pass.expires_at} />
        )}
      </div>

      {/* Welcome message */}
      {pass.welcome_message && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{pass.welcome_message}</p>
        </div>
      )}

      {/* Section cards */}
      <div className="space-y-4">
        {/* Wi-Fi */}
        {sections.wifi && <WifiCard wifi={sections.wifi} />}

        {/* Parking */}
        {sections.parking && (
          <GuestCard icon="🅿️" title="Parking">
            <p className="text-sm text-app-text-strong whitespace-pre-wrap">{sections.parking}</p>
          </GuestCard>
        )}

        {/* Entry Instructions */}
        {sections.entry_instructions && (
          <GuestCard icon="🚪" title="Entry Instructions">
            <p className="text-sm text-app-text-strong whitespace-pre-wrap">{sections.entry_instructions}</p>
          </GuestCard>
        )}

        {/* House Rules */}
        {sections.house_rules && (
          <GuestCard icon="📋" title="House Rules">
            <p className="text-sm text-app-text-strong whitespace-pre-wrap">{sections.house_rules}</p>
          </GuestCard>
        )}

        {/* Trash Day */}
        {sections.trash_day && (
          <GuestCard icon="🗑️" title="Trash Day">
            <p className="text-sm text-app-text-strong capitalize">{sections.trash_day}</p>
          </GuestCard>
        )}

        {/* Local Tips */}
        {sections.local_tips && (
          <GuestCard icon="📍" title="Local Tips">
            <p className="text-sm text-app-text-strong whitespace-pre-wrap">{sections.local_tips}</p>
          </GuestCard>
        )}

        {/* Emergency */}
        {sections.emergency && sections.emergency.length > 0 && (
          <GuestCard icon="🚨" title="Emergency Info">
            <div className="space-y-3">
              {sections.emergency.map((item: { type?: string; label?: string; title?: string; location?: string; phone?: string; notes?: string }, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 text-sm shrink-0">
                    {item.type === 'shutoff' ? '🔧' : item.type === 'contact' ? '📞' : '⚠️'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-app-text">{item.label || item.title || 'Emergency'}</div>
                    {item.location && <div className="text-xs text-app-text-secondary">{item.location}</div>}
                    {item.phone && (
                      <a href={`tel:${item.phone}`} className="text-xs text-blue-600 hover:underline">{item.phone}</a>
                    )}
                    {item.notes && <div className="text-xs text-app-text-secondary mt-0.5">{item.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </GuestCard>
        )}

        {/* Shared Documents */}
        {sections.docs && sections.docs.length > 0 && (
          <GuestCard icon="📄" title="Shared Documents">
            <div className="space-y-2">
              {sections.docs.map((doc: { url?: string; file_type?: string; title?: string; filename?: string; description?: string }, i: number) => (
                <a
                  key={i}
                  href={doc.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-app-hover transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center text-app-text-secondary text-xs font-bold shrink-0">
                    {(doc.file_type || 'PDF').toUpperCase().slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-app-text truncate">{doc.title || doc.filename || 'Document'}</div>
                    {doc.description && <div className="text-xs text-app-text-secondary truncate">{doc.description}</div>}
                  </div>
                  <svg className="w-4 h-4 text-app-text-muted shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </a>
              ))}
            </div>
          </GuestCard>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-app-border-subtle text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text-secondary transition"
        >
          <LayoutDashboard className="w-6 h-6 text-primary-600" />
          <span>Powered by Pantopus</span>
        </Link>
      </div>
    </PageShell>
  );
}

// ============================================================
// Sub-components
// ============================================================

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-surface-raised">
      <div className="max-w-lg mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}

function GuestCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-app-text mb-3 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ---- Wi-Fi Card with reveal + QR ----

function WifiCard({ wifi }: { wifi: { network_name: string; password: string } | { network_name: string; password: string }[] }) {
  const networks = Array.isArray(wifi) ? wifi : [wifi];

  return (
    <GuestCard icon="📶" title="Wi-Fi">
      <div className="space-y-4">
        {networks.map((net, i) => (
          <WifiEntry key={i} network={net} />
        ))}
      </div>
    </GuestCard>
  );
}

function WifiEntry({ network }: { network: { network_name: string; password: string } }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(network.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  // WIFI QR code string format: WIFI:T:WPA;S:network;P:password;;
  const wifiQrData = `WIFI:T:WPA;S:${network.network_name};P:${network.password};;`;

  return (
    <div className="space-y-3">
      {/* Network name */}
      <div>
        <div className="text-[10px] font-medium text-app-text-muted uppercase tracking-wider mb-1">Network</div>
        <div className="text-lg font-semibold text-app-text">{network.network_name}</div>
      </div>

      {/* Password with reveal */}
      <div>
        <div className="text-[10px] font-medium text-app-text-muted uppercase tracking-wider mb-1">Password</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-app-surface-raised border border-app-border rounded-lg px-3 py-2 font-mono text-sm">
            {revealed ? network.password : '••••••••••••'}
          </div>
          <button
            onClick={() => setRevealed(!revealed)}
            className="p-2 rounded-lg border border-app-border text-app-text-secondary hover:bg-app-hover transition"
            title={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleCopyPassword}
            className="p-2 rounded-lg border border-app-border text-app-text-secondary hover:bg-app-hover transition"
            title="Copy password"
          >
            {copied ? (
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* QR quick connect */}
      <div className="bg-app-surface-raised border border-app-border rounded-lg p-3 text-center">
        <div className="text-[10px] font-medium text-app-text-muted uppercase tracking-wider mb-2">Quick Connect</div>
        <div className="inline-flex items-center justify-center bg-app-surface p-3 rounded-lg border border-app-border-subtle">
          {/* Simple QR placeholder — encode wifiQrData as a data attribute for client-side QR libs */}
          <div
            className="w-32 h-32 bg-app-surface-sunken rounded flex items-center justify-center text-app-text-muted"
            data-wifi-qr={wifiQrData}
            title="Scan with your phone camera"
          >
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="text-[10px]">QR Code</span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-app-text-muted mt-1.5">Scan to connect automatically</p>
      </div>
    </div>
  );
}

// ---- Expiry Countdown ----

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const exp = new Date(expiresAt).getTime();
      const diff = exp - now;

      if (diff <= 0) {
        setIsExpired(true);
        setRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setRemaining(`Expires in ${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setRemaining(`Expires in ${hours}h ${minutes}m`);
      } else {
        setRemaining(`Expires in ${minutes}m`);
      }
    };

    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (isExpired) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
        Expired
      </div>
    );
  }

  return (
    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
      {remaining}
    </div>
  );
}
