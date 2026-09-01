'use client';

import { useState, useEffect, useRef } from 'react';
import type { RelationshipUser } from '@pantopus/types';

// ============================================================
// Preset-based roles (loaded from API, with hardcoded fallbacks)
// ============================================================

const DEFAULT_PRESETS = [
  { key: 'spouse',          display_name: '🛡️ Spouse / Partner (Co-admin)', description: 'Full household control', role_base: 'admin' },
  { key: 'tenant',          display_name: '🏠 Tenant / Roommate',           description: 'Tasks, calendar, mailbox. No finance', role_base: 'member' },
  { key: 'extended_family', display_name: '👨‍👩‍👧 Extended Family (Long Stay)', description: 'Weeks-months visit with end date', role_base: 'member' },
  { key: 'child',           display_name: '👶 Child',                        description: 'Chores + basic visibility only', role_base: 'restricted_member' },
  { key: 'airbnb_guest',    display_name: '🎒 Airbnb / Short Stay Guest',   description: 'WiFi, rules, calendar. No docs/mailbox', role_base: 'guest' },
  { key: 'cleaner_vendor',  display_name: '🔧 Cleaner / Vendor',            description: 'Scoped task + issue access only', role_base: 'guest' },
];

export default function InviteMemberModal({
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
    relationship: string;    // preset key or role_base
    preset_key?: string;
    message?: string;
    start_at?: string;
    end_at?: string;
  }) => Promise<void>;
  homeId?: string;
}) {
  const [mode, setMode] = useState<'email' | 'username'>('email');
  const [email, setEmail] = useState('');
  const [usernameQuery, setUsernameQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RelationshipUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<RelationshipUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('tenant');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [showDates, setShowDates] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Load presets from API
  useEffect(() => {
    if (!open || !homeId) return;
    (async () => {
      try {
        const { get } = await import('@pantopus/api');
        const data = await get(`/api/homes/${homeId}/role-presets`);
        if ((data as Record<string, any>).presets?.length) {
          setPresets(((data as Record<string, any>).presets as Record<string, any>[]).map((p: Record<string, any>) => ({
            key: p.key as string,
            display_name: p.display_name as string,
            description: p.description as string,
            role_base: p.role_base as string,
          })));
        }
      } catch {
        // Keep defaults
      }
    })();
  }, [open, homeId]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setEmail('');
      setUsernameQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setSelectedPreset('tenant');
      setMessage('');
      setError('');
      setSuccess('');
      setShowDates(false);
      setStartAt('');
      setEndAt('');
    }
  }, [open]);

  // Debounced username search
  useEffect(() => {
    if (mode !== 'username' || usernameQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { get } = await import('@pantopus/api');
        const data = await get(`/api/users/search?q=${encodeURIComponent(usernameQuery)}&limit=5`);
        setSearchResults((data as Record<string, any>).users as RelationshipUser[] || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(searchTimer.current);
  }, [usernameQuery, mode]);

  // Show dates for time-limited presets
  const needsDates = ['airbnb_guest', 'extended_family', 'cleaner_vendor'].includes(selectedPreset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'email') {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }
    } else {
      if (!selectedUser) {
        setError('Please search and select a user');
        return;
      }
    }

	    setSending(true);
	    try {
	      const preset = presets.find(p => p.key === selectedPreset);
	      const inviteUser = mode === 'username' ? selectedUser : null;
	      await onInvite({
	        email: mode === 'email' ? email.trim() : undefined,
	        user_id: inviteUser?.id,
	        username: inviteUser?.username,
        relationship: preset?.role_base || 'member',
        preset_key: selectedPreset,
        message: message.trim() || undefined,
        start_at: startAt || undefined,
        end_at: endAt || undefined,
      });
	      setSuccess(
	        mode === 'email'
	          ? `Invitation sent to ${email}`
	          : `Invitation sent to @${inviteUser?.username || usernameQuery}`
	      );
      setEmail('');
      setUsernameQuery('');
      setSelectedUser(null);
      setSearchResults([]);
      setMessage('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div
          className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-app-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-app-text">Invite Member</h2>
                <p className="text-xs text-app-text-secondary mt-0.5">Add someone to your home</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-app-hover rounded-lg transition text-app-text-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex bg-app-surface-sunken rounded-lg p-0.5 mt-4">
              <button
                type="button"
                onClick={() => { setMode('email'); setSelectedUser(null); setSearchResults([]); }}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${
                  mode === 'email' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                ✉️ By Email
              </button>
              <button
                type="button"
                onClick={() => { setMode('username'); setEmail(''); }}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${
                  mode === 'username' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                👤 By Username
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">{error}</div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2">
                <span>✅</span> {success}
              </div>
            )}

            {/* Email input */}
            {mode === 'email' && (
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="roommate@example.com"
                  className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-app-text-muted mt-1">
                  They&apos;ll get an invitation even if they don&apos;t have a Pantopus account yet.
                </p>
              </div>
            )}

            {/* Username search */}
            {mode === 'username' && (
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1">Search by username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={usernameQuery}
                    onChange={(e) => { setUsernameQuery(e.target.value); setSelectedUser(null); }}
                    placeholder="Type a username..."
                    className="w-full px-3 py-2.5 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      <div className="text-sm font-medium text-app-text truncate">
                        {selectedUser.name || selectedUser.username}
                      </div>
                      <div className="text-xs text-app-text-secondary">@{selectedUser.username}</div>
                    </div>
                    <button
                      type="button"
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
                        type="button"
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
                  <p className="text-xs text-app-text-muted mt-2">No users found. Try a different search or invite by email.</p>
                )}
              </div>
            )}

            {/* Role preset selection */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Role in household</label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setSelectedPreset(p.key)}
                    className={`text-left px-3 py-2.5 rounded-lg border transition ${
                      selectedPreset === p.key
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border'
                    }`}
                  >
                    <div className="text-sm font-medium">{p.display_name}</div>
                    <div className={`text-[10px] mt-0.5 ${selectedPreset === p.key ? 'text-gray-300' : 'text-app-text-muted'}`}>
                      {p.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date range (for time-limited presets) */}
            {(needsDates || showDates) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1">Start date</label>
                  <input
                    type="date"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-app-text-secondary mb-1">End date</label>
                  <input
                    type="date"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
            {!needsDates && !showDates && (
              <button
                type="button"
                onClick={() => setShowDates(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                + Set start/end dates
              </button>
            )}

            {/* Optional message */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">
                Message <span className="text-app-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! Join our household on Pantopus..."
                rows={2}
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                maxLength={300}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
              >
                {success ? 'Done' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={sending || (mode === 'email' ? !email.trim() : !selectedUser)}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
