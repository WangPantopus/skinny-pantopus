'use client';

import { useState, useEffect, useRef } from 'react';
import * as api from '@pantopus/api';
import type { User } from '@pantopus/types';
import SlidePanel from '../SlidePanel';

// ---- Preset roles ----

const DEFAULT_PRESETS = [
  { key: 'spouse',          display_name: 'Spouse / Partner (Co-admin)', icon: '🛡️', description: 'Full household control', role_base: 'admin' },
  { key: 'tenant',          display_name: 'Tenant / Roommate', icon: '🏠', description: 'Tasks, calendar, mailbox. No finance', role_base: 'member' },
  { key: 'extended_family', display_name: 'Extended Family (Long Stay)', icon: '👨‍👩‍👧', description: 'Weeks-months visit with end date', role_base: 'member' },
  { key: 'child',           display_name: 'Child', icon: '👶', description: 'Chores + basic visibility only', role_base: 'restricted_member' },
  { key: 'airbnb_guest',    display_name: 'Airbnb / Short Stay Guest', icon: '🎒', description: 'WiFi, rules, calendar. No docs/mailbox', role_base: 'guest' },
  { key: 'cleaner_vendor',  display_name: 'Cleaner / Vendor', icon: '🔧', description: 'Scoped task + issue access only', role_base: 'guest' },
];

type Step = 'method' | 'role' | 'review';
type InviteMethod = 'email' | 'username' | 'qr';

export default function InviteFlow({
  open,
  onClose,
  onInvite,
  homeId,
}: {
  open: boolean;
  onClose: () => void;
  onInvite: (data: {
    email?: string;
    user_id?: string;
    username?: string;
    relationship: string;
    preset_key?: string;
    message?: string;
    start_at?: string;
    end_at?: string;
  }) => Promise<void>;
  homeId: string;
}) {
  const [step, setStep] = useState<Step>('method');

  // Method step
  const [method, setMethod] = useState<InviteMethod>('email');
  const [email, setEmail] = useState('');
  const [usernameQuery, setUsernameQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Role step
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState('tenant');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [message, setMessage] = useState('');

  // Result
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // QR invite URL
  const [qrInviteUrl, setQrInviteUrl] = useState('');

  // Load presets
  useEffect(() => {
    if (!open || !homeId) return;
    (async () => {
      try {
        const res = await api.homeIam.getRolePresets(homeId);
        if (res.presets?.length) {
          setPresets(res.presets.map((p) => ({
            key: p.key,
            display_name: p.display_name,
            icon: p.icon_key || '🏠',
            description: p.description,
            role_base: p.role_base,
          })));
        }
      } catch {
        // Keep defaults
      }
    })();
  }, [open, homeId]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('method');
      setMethod('email');
      setEmail('');
      setUsernameQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setSelectedPreset('tenant');
      setStartAt('');
      setEndAt('');
      setMessage('');
      setError('');
      setSuccess('');
      setQrInviteUrl('');
    }
  }, [open]);

  // Debounced username search
  useEffect(() => {
    if (method !== 'username' || usernameQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { get } = await import('@pantopus/api');
        const data = await get(`/api/users/search?q=${encodeURIComponent(usernameQuery)}&limit=5`);
        setSearchResults((data as { users?: User[] }).users || []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 350);

    return () => clearTimeout(searchTimer.current);
  }, [usernameQuery, method]);

  const needsDates = ['airbnb_guest', 'extended_family', 'cleaner_vendor'].includes(selectedPreset);

  const canProceedFromMethod = () => {
    if (method === 'email') return email.trim().includes('@');
    if (method === 'username') return !!selectedUser;
    if (method === 'qr') return true;
    return false;
  };

  const handleGoToRole = () => {
    if (method === 'qr') {
      // Generate QR invite URL
      if (typeof window !== 'undefined') {
        setQrInviteUrl(`${window.location.origin}/invite/${homeId}`);
      }
    }
    setStep('role');
  };

	  const handleSubmit = async () => {
	    setError('');
	    if (method === 'username' && !selectedUser) {
	      setError('Please search and select a user');
	      return;
	    }
	    setSending(true);
	    try {
	      const preset = presets.find((p) => p.key === selectedPreset);
	      const inviteUser = method === 'username' ? selectedUser : null;
	      await onInvite({
	        email: method === 'email' ? email.trim() : undefined,
	        user_id: inviteUser?.id,
	        username: inviteUser?.username,
        relationship: preset?.role_base || 'member',
        preset_key: selectedPreset,
        message: message.trim() || undefined,
        start_at: startAt || undefined,
        end_at: endAt || undefined,
      });
      setSuccess(
        method === 'email'
	          ? `Invitation sent to ${email}`
	          : method === 'username'
	          ? `Invitation sent to @${inviteUser?.username || usernameQuery}`
	          : 'Invite link generated'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
    setSending(false);
  };

  const selectedPresetData = presets.find((p) => p.key === selectedPreset);

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={success ? 'Invitation Sent!' : 'Invite Member'}
      subtitle={!success ? `Step ${step === 'method' ? '1' : step === 'role' ? '2' : '3'} of 3` : undefined}
    >
      <div className="space-y-5">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {success ? (
          /* ===== Success ===== */
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-app-text">{success}</h3>
              <p className="text-xs text-app-text-secondary mt-1">They&apos;ll see the invitation in their dashboard.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* ===== Step 1: Choose Method ===== */}
            {step === 'method' && (
              <div className="space-y-4">
                <div className="flex bg-app-surface-sunken rounded-lg p-0.5">
                  {([
                    { key: 'email', label: '✉️ Email', desc: 'Send invite via email' },
                    { key: 'username', label: '👤 Username', desc: 'Search existing users' },
                    { key: 'qr', label: '📱 QR Code', desc: 'Scan in person' },
                  ] as { key: InviteMethod; label: string; desc: string }[]).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => { setMethod(m.key); setSelectedUser(null); setEmail(''); setUsernameQuery(''); setSearchResults([]); }}
                      className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition ${
                        method === m.key ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-secondary hover:text-app-text'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Email input */}
                {method === 'email' && (
                  <div>
                    <label className="block text-xs font-medium text-app-text-secondary mb-1">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="roommate@example.com"
                      className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm"
                      autoFocus
                    />
                    <p className="text-[10px] text-app-text-muted mt-1">
                      They&apos;ll get an invitation even without a Pantopus account.
                    </p>
                  </div>
                )}

                {/* Username search */}
                {method === 'username' && (
                  <div>
                    <label className="block text-xs font-medium text-app-text-secondary mb-1">Search by username</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={usernameQuery}
                        onChange={(e) => { setUsernameQuery(e.target.value); setSelectedUser(null); }}
                        placeholder="Type a username..."
                        className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm"
                        autoFocus
                      />
                      {searching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {selectedUser && (
                      <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(selectedUser.name || selectedUser.username)?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-app-text truncate">{selectedUser.name || selectedUser.username}</div>
                          <div className="text-xs text-app-text-secondary">@{selectedUser.username}</div>
                        </div>
                        <button
                          onClick={() => { setSelectedUser(null); setUsernameQuery(''); }}
                          className="text-app-text-muted hover:text-app-text-secondary p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {!selectedUser && searchResults.length > 0 && (
                      <div className="mt-1 bg-app-surface border border-app-border rounded-lg shadow-lg overflow-hidden">
                        {searchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => { setSelectedUser(u); setUsernameQuery(u.username); setSearchResults([]); }}
                            className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-app-hover transition"
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {(u.name || u.username)?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-app-text truncate">{u.name || u.username}</div>
                              <div className="text-xs text-app-text-secondary">@{u.username}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {!selectedUser && usernameQuery.length >= 2 && !searching && searchResults.length === 0 && (
                      <p className="text-xs text-app-text-muted mt-2">No users found.</p>
                    )}
                  </div>
                )}

                {/* QR invite */}
                {method === 'qr' && (
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">📱</div>
                    <p className="text-sm text-app-text-strong font-medium">In-Person QR Invite</p>
                    <p className="text-xs text-app-text-secondary mt-1">
                      Generate a QR code for the person standing next to you.
                      They&apos;ll scan it to join your home instantly.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGoToRole}
                  disabled={!canProceedFromMethod()}
                  className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  Next: Choose Role
                </button>
              </div>
            )}

            {/* ===== Step 2: Choose Role ===== */}
            {step === 'role' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-2">Role in household</label>
                  <div className="space-y-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => setSelectedPreset(p.key)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${
                          selectedPreset === p.key
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{p.icon}</span>
                          <span className="text-sm font-medium">{p.display_name}</span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ml-6 ${selectedPreset === p.key ? 'text-gray-300' : 'text-app-text-muted'}`}>
                          {p.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date range for time-limited roles */}
                {needsDates && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-app-text-secondary mb-1">Start date</label>
                      <input
                        type="date"
                        value={startAt}
                        onChange={(e) => setStartAt(e.target.value)}
                        className="w-full px-3 py-2 border border-app-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-app-text-secondary mb-1">End date</label>
                      <input
                        type="date"
                        value={endAt}
                        onChange={(e) => setEndAt(e.target.value)}
                        className="w-full px-3 py-2 border border-app-border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1">
                    Message <span className="text-app-text-muted">(optional)</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hey! Join our household on Pantopus..."
                    rows={2}
                    className="w-full px-3 py-2 border border-app-border rounded-lg text-sm resize-none"
                    maxLength={300}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('method')}
                    className="flex-1 py-2.5 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep('review')}
                    className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
                  >
                    Next: Review
                  </button>
                </div>
              </div>
            )}

            {/* ===== Step 3: Review & Send ===== */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="bg-app-surface-raised rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider">Invite Summary</h4>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-app-text-secondary">Inviting</span>
                      <span className="text-sm font-medium text-app-text">
                        {method === 'email' ? email : method === 'username' ? `@${selectedUser?.username}` : 'QR invite'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-app-text-secondary">Role</span>
                      <span className="text-sm font-medium text-app-text">
                        {selectedPresetData?.icon} {selectedPresetData?.display_name}
                      </span>
                    </div>
                    {startAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-app-text-secondary">Start</span>
                        <span className="text-sm text-app-text-strong">{new Date(startAt + 'T00:00:00').toLocaleDateString()}</span>
                      </div>
                    )}
                    {endAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-app-text-secondary">End</span>
                        <span className="text-sm text-app-text-strong">{new Date(endAt + 'T00:00:00').toLocaleDateString()}</span>
                      </div>
                    )}
                    {message && (
                      <div>
                        <span className="text-xs text-app-text-secondary">Message</span>
                        <p className="text-sm text-app-text-strong mt-0.5 italic">&ldquo;{message}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* QR Code display for QR method */}
                {method === 'qr' && qrInviteUrl && (
                  <div className="bg-app-surface rounded-xl border border-app-border p-4 text-center">
                    <div className="bg-app-surface-raised rounded-lg p-4 inline-block">
                      <div className="w-[160px] h-[160px] bg-app-surface-sunken rounded flex items-center justify-center text-4xl">
                        📱
                      </div>
                    </div>
                    <p className="text-[10px] text-app-text-muted mt-2">QR code will be generated when invite is sent</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('role')}
                    className="flex-1 py-2.5 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={sending}
                    className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    {sending ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </SlidePanel>
  );
}
