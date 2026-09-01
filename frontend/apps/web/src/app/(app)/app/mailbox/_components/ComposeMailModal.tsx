'use client';

import { useState, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import * as api from '@pantopus/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import type {
  ComposeMode, QuickComposeForm, StructuredComposeForm,
  MailType, QuickDestinationType, MailDeliveryVisibility, ObjectFormat, AvailableHome,
} from './mailbox-types';
import {
  MAIL_TYPES, QUICK_COMPOSE_DEFAULTS, QUICK_COMPOSE_TYPE_OPTIONS,
  COMPOSE_FIELD_CLASS, COMPOSE_SELECT_CLASS, COMPOSE_TEXTAREA_CLASS,
  STRUCTURED_COMPOSE_DEFAULTS,
} from './mailbox-constants';

type RecipientUser = { id: string; name?: string; username?: string; city?: string | null; state?: string | null };

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const apiError = err as {
      message?: unknown;
      data?: { message?: unknown; error?: unknown };
    };
    if (typeof apiError.message === 'string' && apiError.message.trim()) {
      return apiError.message;
    }
    if (typeof apiError.data?.message === 'string' && apiError.data.message.trim()) {
      return apiError.data.message;
    }
    if (typeof apiError.data?.error === 'string' && apiError.data.error.trim()) {
      return apiError.data.error;
    }
  }
  return fallback;
}

interface ComposeMailModalProps {
  currentUserId: string;
  availableHomes: AvailableHome[];
  scopeHomeId: string;
  onClose: () => void;
  onSent: () => void;
  setActionError: (msg: string) => void;
  setActionSuccess: (msg: string) => void;
}

export default function ComposeMailModal({
  currentUserId, availableHomes, scopeHomeId, onClose, onSent, setActionError, setActionSuccess,
}: ComposeMailModalProps) {
  const [composeMode, setComposeMode] = useState<ComposeMode>('quick');
  const [composeLoading, setComposeLoading] = useState(false);

  // Quick compose state
  const [quickComposeData, setQuickComposeData] = useState<QuickComposeForm>(() => ({
    ...QUICK_COMPOSE_DEFAULTS,
    destinationHomeId: scopeHomeId || availableHomes[0]?.id || '',
  }));
  const [quickAddressInput, setQuickAddressInput] = useState('');
  const [quickRecipientResults, setQuickRecipientResults] = useState<RecipientUser[]>([]);
  const [quickRecipientLoading, setQuickRecipientLoading] = useState(false);
  const [quickRecipientDropdownOpen, setQuickRecipientDropdownOpen] = useState(false);
  const [quickRecipientActiveIndex, setQuickRecipientActiveIndex] = useState(-1);
  const [quickRecipientCopied, setQuickRecipientCopied] = useState(false);
  const quickRecipientContainerRef = useRef<HTMLDivElement | null>(null);

  // Structured compose state
  const [structuredComposeData, setStructuredComposeData] = useState<StructuredComposeForm>(() => ({
    ...STRUCTURED_COMPOSE_DEFAULTS,
    recipientHomeId: scopeHomeId || availableHomes[0]?.id || '',
  }));
  const [structuredAddressInput, setStructuredAddressInput] = useState('');
  const [structuredRecipientResults, setStructuredRecipientResults] = useState<RecipientUser[]>([]);
  const [structuredRecipientLoading, setStructuredRecipientLoading] = useState(false);
  const [structuredRecipientDropdownOpen, setStructuredRecipientDropdownOpen] = useState(false);
  const [structuredRecipientActiveIndex, setStructuredRecipientActiveIndex] = useState(-1);
  const structuredRecipientContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync address inputs with home labels
  useEffect(() => {
    if (!quickComposeData.destinationHomeId) return;
    const selected = availableHomes.find((h) => h.id === quickComposeData.destinationHomeId);
    if (selected) setQuickAddressInput(selected.label);
  }, [quickComposeData.destinationHomeId, availableHomes]);

  useEffect(() => {
    if (!structuredComposeData.recipientHomeId) return;
    const selected = availableHomes.find((h) => h.id === structuredComposeData.recipientHomeId);
    if (selected) setStructuredAddressInput(selected.label);
  }, [structuredComposeData.recipientHomeId, availableHomes]);

  // Quick recipient search
  useEffect(() => {
    if (composeMode !== 'quick' || quickComposeData.destinationType !== 'person') {
      setQuickRecipientResults([]); setQuickRecipientDropdownOpen(false); setQuickRecipientLoading(false); setQuickRecipientActiveIndex(-1);
      return;
    }
    const query = quickComposeData.recipientQuery.trim();
    if (query.length < 2) {
      setQuickRecipientResults([]); setQuickRecipientDropdownOpen(false); setQuickRecipientLoading(false); setQuickRecipientActiveIndex(-1);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setQuickRecipientLoading(true);
      try {
        const response = await api.users.searchUsers(query, { limit: 6 });
        if (cancelled) return;
        const users = response?.users || [];
        setQuickRecipientResults(users); setQuickRecipientDropdownOpen(true); setQuickRecipientActiveIndex(users.length > 0 ? 0 : -1);
      } catch { if (!cancelled) { setQuickRecipientResults([]); setQuickRecipientDropdownOpen(false); setQuickRecipientActiveIndex(-1); }
      } finally { if (!cancelled) setQuickRecipientLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [composeMode, quickComposeData.recipientQuery, quickComposeData.destinationType]);

  // Structured recipient search
  useEffect(() => {
    if (composeMode !== 'structured' || structuredComposeData.recipientMode !== 'user') {
      setStructuredRecipientResults([]); setStructuredRecipientDropdownOpen(false); setStructuredRecipientLoading(false); setStructuredRecipientActiveIndex(-1);
      return;
    }
    const query = structuredComposeData.recipientQuery.trim();
    if (query.length < 2) {
      setStructuredRecipientResults([]); setStructuredRecipientDropdownOpen(false); setStructuredRecipientLoading(false); setStructuredRecipientActiveIndex(-1);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setStructuredRecipientLoading(true);
      try {
        const response = await api.users.searchUsers(query, { limit: 6 });
        if (cancelled) return;
        const users = response?.users || [];
        setStructuredRecipientResults(users); setStructuredRecipientDropdownOpen(true); setStructuredRecipientActiveIndex(users.length > 0 ? 0 : -1);
      } catch { if (!cancelled) { setStructuredRecipientResults([]); setStructuredRecipientDropdownOpen(false); setStructuredRecipientActiveIndex(-1); }
      } finally { if (!cancelled) setStructuredRecipientLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [composeMode, structuredComposeData.recipientMode, structuredComposeData.recipientQuery]);

  // Auto-set self recipient
  useEffect(() => {
    if (quickComposeData.destinationType !== 'self' || !currentUserId) return;
    setQuickComposeData((prev) => {
      if (prev.recipientUserId === currentUserId && prev.recipientQuery === 'Me') return prev;
      return { ...prev, recipientUserId: currentUserId, recipientQuery: 'Me', visibility: 'attn_only' };
    });
  }, [quickComposeData.destinationType, currentUserId]);

  // Outside click handlers
  useEffect(() => {
    if (!quickRecipientDropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (quickRecipientContainerRef.current && target && !quickRecipientContainerRef.current.contains(target))
        setQuickRecipientDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [quickRecipientDropdownOpen]);

  useEffect(() => {
    if (!structuredRecipientDropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (structuredRecipientContainerRef.current && target && !structuredRecipientContainerRef.current.contains(target))
        setStructuredRecipientDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [structuredRecipientDropdownOpen]);

  const matchHomeRouteFromAddress = (address: string) => {
    const normalized = address.trim().toLowerCase();
    if (!normalized) return null;
    return availableHomes.find((home) => {
      const search = home.searchText || home.label.toLowerCase();
      return search.includes(normalized) || normalized.includes(search);
    }) || null;
  };

  // Recipient handlers
  const handleQuickRecipientInputChange = (value: string) => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(value.trim());
    setQuickComposeData(prev => ({ ...prev, recipientQuery: value, recipientUserId: isUuid ? value.trim() : '' }));
    setQuickRecipientActiveIndex(0);
  };

  const selectQuickRecipient = (user: RecipientUser) => {
    const display = user.name || (user.username ? `@${user.username}` : user.id);
    setQuickComposeData(prev => ({ ...prev, recipientUserId: user.id, recipientQuery: display }));
    setQuickRecipientDropdownOpen(false); setQuickRecipientActiveIndex(-1); setQuickRecipientCopied(false);
  };

  const handleCopyQuickRecipientId = async () => {
    if (!quickComposeData.recipientUserId) return;
    try { await navigator.clipboard.writeText(quickComposeData.recipientUserId); setQuickRecipientCopied(true); window.setTimeout(() => setQuickRecipientCopied(false), 1200); } catch { setQuickRecipientCopied(false); }
  };

  const handleQuickRecipientKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!quickRecipientDropdownOpen || quickRecipientResults.length === 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setQuickRecipientActiveIndex((prev) => (prev + 1) % quickRecipientResults.length); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setQuickRecipientActiveIndex((prev) => (prev <= 0 ? quickRecipientResults.length - 1 : prev - 1)); return; }
    if (event.key === 'Enter') { event.preventDefault(); const selected = quickRecipientResults[Math.max(0, quickRecipientActiveIndex)]; if (selected) selectQuickRecipient(selected); return; }
    if (event.key === 'Escape') { event.preventDefault(); setQuickRecipientDropdownOpen(false); setQuickRecipientActiveIndex(-1); }
  };

  const handleStructuredRecipientInputChange = (value: string) => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(value.trim());
    setStructuredComposeData(prev => ({ ...prev, recipientQuery: value, recipientUserId: isUuid ? value.trim() : '' }));
    setStructuredRecipientActiveIndex(0);
  };

  const selectStructuredRecipient = (user: RecipientUser) => {
    const display = user.name || (user.username ? `@${user.username}` : user.id);
    setStructuredComposeData(prev => ({ ...prev, recipientUserId: user.id, recipientQuery: display }));
    setStructuredRecipientDropdownOpen(false); setStructuredRecipientActiveIndex(-1);
  };

  const handleStructuredRecipientKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!structuredRecipientDropdownOpen || structuredRecipientResults.length === 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setStructuredRecipientActiveIndex((prev) => (prev + 1) % structuredRecipientResults.length); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setStructuredRecipientActiveIndex((prev) => (prev <= 0 ? structuredRecipientResults.length - 1 : prev - 1)); return; }
    if (event.key === 'Enter') { event.preventDefault(); const selected = structuredRecipientResults[Math.max(0, structuredRecipientActiveIndex)]; if (selected) selectStructuredRecipient(selected); return; }
    if (event.key === 'Escape') { event.preventDefault(); setStructuredRecipientDropdownOpen(false); setStructuredRecipientActiveIndex(-1); }
  };

  // Payload builders
  const buildQuickPayload = (): api.mailbox.StructuredMailSendPayload => {
    const destinationHomeId = quickComposeData.destinationHomeId.trim();
    const explicitRecipientUserId = quickComposeData.recipientUserId.trim();
    const content = quickComposeData.content.trim();
    const isSelfDestination = quickComposeData.destinationType === 'self';
    const isPersonDestination = quickComposeData.destinationType === 'person' || isSelfDestination;
    const effectiveRecipientUserId = isSelfDestination ? currentUserId : explicitRecipientUserId;
    if (!destinationHomeId) throw new Error('Address (home) is required.');
    if (isSelfDestination && !currentUserId) throw new Error('Current user profile is not loaded yet. Try again.');
    if (isPersonDestination && !effectiveRecipientUserId) throw new Error('Recipient person is required.');
    if (!content) throw new Error('Content is required.');
    return {
      destination: {
        deliveryTargetType: isPersonDestination ? 'user' as const : 'home' as const,
        homeId: destinationHomeId,
        userId: isPersonDestination ? effectiveRecipientUserId : undefined,
        attnUserId: isPersonDestination ? effectiveRecipientUserId : undefined,
        attnLabel: !isPersonDestination ? (quickComposeData.attnLabel.trim() || 'Current Resident') : undefined,
        visibility: isPersonDestination ? quickComposeData.visibility : 'home_members'
      },
      envelope: { type: quickComposeData.type, subject: quickComposeData.subject.trim() || undefined },
      object: { format: 'mailjson_v1' as const, mimeType: 'application/json', title: quickComposeData.subject.trim() || undefined, content, payload: { bodyFormat: 'plain_text' } },
      tracking: { source: 'mailbox_compose_quick_destination_web_v2' }
    };
  };

  const buildStructuredPayload = (): api.mailbox.StructuredMailSendPayload => {
    const recipientMode = structuredComposeData.recipientMode;
    const recipientUserId = structuredComposeData.recipientUserId.trim();
    const recipientHomeId = structuredComposeData.recipientHomeId.trim();
    const content = structuredComposeData.content.trim();
    const effectiveUserId = recipientMode === 'self' ? currentUserId : recipientUserId;
    if (!content) throw new Error('Content is required.');
    if (!recipientHomeId) throw new Error('Address home ID is required.');
    if (recipientMode === 'user' && !effectiveUserId) throw new Error('Recipient user ID is required.');
    if (recipientMode === 'self' && !effectiveUserId) throw new Error('Current user profile is not loaded yet. Try again.');
    const tags = structuredComposeData.tags.split(',').map((part) => part.trim()).filter(Boolean);
    const payoutAmount = structuredComposeData.payoutAmount.trim() ? Number(structuredComposeData.payoutAmount) : undefined;
    return {
      destination: {
        deliveryTargetType: recipientMode === 'home' ? 'home' as const : 'user' as const,
        homeId: recipientHomeId,
        userId: recipientMode === 'home' ? undefined : effectiveUserId,
        attnUserId: recipientMode === 'home' ? undefined : effectiveUserId,
        visibility: recipientMode === 'home' ? 'home_members' : 'attn_only'
      },
      recipient: { mode: recipientMode === 'home' ? 'home' : 'user', userId: recipientMode === 'home' ? undefined : effectiveUserId, homeId: recipientHomeId },
      envelope: {
        type: structuredComposeData.type, subject: structuredComposeData.subject.trim() || undefined,
        category: structuredComposeData.category.trim() || undefined, tags: tags.length ? tags : undefined,
        priority: structuredComposeData.priority, senderBusinessName: structuredComposeData.senderBusinessName.trim() || undefined,
        senderAddress: structuredComposeData.senderAddress.trim() || undefined
      },
      object: { format: 'mailjson_v1' as const, mimeType: 'application/json', title: structuredComposeData.subject.trim() || undefined, content, payload: { bodyFormat: structuredComposeData.objectFormat } },
      policy: { payoutAmount: Number.isFinite(payoutAmount) ? payoutAmount : undefined },
      tracking: { source: 'mailbox_compose_structured_destination_web_v2' }
    };
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setComposeLoading(true);
    try {
      const payload = composeMode === 'quick' ? buildQuickPayload() : buildStructuredPayload();
      await api.mailbox.sendMail(payload);
      onClose();
      onSent();
      setActionSuccess('Mail sent successfully.');
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to send mail.'));
    } finally { setComposeLoading(false); }
  };

  const handleClose = () => {
    setQuickRecipientDropdownOpen(false); setQuickRecipientActiveIndex(-1);
    setStructuredRecipientDropdownOpen(false); setStructuredRecipientActiveIndex(-1);
    onClose();
  };

  const renderRecipientDropdown = (
    results: RecipientUser[], loading: boolean, query: string,
    activeIndex: number, setActiveIndex: (i: number) => void,
    selectUser: (u: RecipientUser) => void,
  ) => (
    <div className="absolute z-10 mt-1 w-full rounded-lg border border-app-border bg-app-surface shadow-lg max-h-56 overflow-auto">
      {query.trim().length < 2 ? (
        <p className="px-3 py-2 text-xs text-app-text-secondary">Type at least 2 characters.</p>
      ) : loading ? (
        <p className="px-3 py-2 text-xs text-app-text-secondary">Searching users...</p>
      ) : results.length === 0 ? (
        <p className="px-3 py-2 text-xs text-app-text-secondary">No users found.</p>
      ) : (
        results.map((user) => (
          <button
            key={user.id}
            type="button"
            onMouseEnter={() => { const i = results.findIndex((u) => u.id === user.id); if (i >= 0) setActiveIndex(i); }}
            onMouseDown={(e) => { e.preventDefault(); selectUser(user); }}
            className={`w-full text-left px-3 py-2 border-b last:border-b-0 border-app-border-subtle ${
              results[activeIndex]?.id === user.id ? 'bg-blue-50' : 'hover:bg-app-hover'
            }`}
          >
            <p className="text-sm font-medium text-app-text">{user.name || (user.username ? `@${user.username}` : user.id)}</p>
            <p className="text-xs text-app-text-secondary">
              {user.username ? `@${user.username}` : 'User'}{user.city || user.state ? ` • ${[user.city, user.state].filter(Boolean).join(', ')}` : ''}
            </p>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-app-surface rounded-xl border border-app-border shadow-xl [color-scheme:light]">
        <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
          <h3 className="text-lg font-semibold text-app-text">Compose Mail</h3>
          <button onClick={handleClose} className="text-app-text-secondary hover:text-app-text-strong text-sm">Close</button>
        </div>
        <form onSubmit={handleSendMail} className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-app-surface-sunken p-1">
            <button type="button" onClick={() => setComposeMode('quick')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${composeMode === 'quick' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-secondary hover:text-app-text'}`}>
              Quick
            </button>
            <button type="button" onClick={() => setComposeMode('structured')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${composeMode === 'structured' ? 'bg-app-surface text-app-text shadow-sm' : 'text-app-text-secondary hover:text-app-text'}`}>
              Structured Object
            </button>
          </div>

          {composeMode === 'quick' ? (
            <div className="space-y-3">
              <p className="text-xs text-app-text-secondary">Address-first compose: deliver to household mail or person-at-home.</p>
              <div className="space-y-2">
                <label className="text-xs font-medium text-app-text-secondary">Step 1 — Destination</label>
                <select value={quickComposeData.destinationType}
                  onChange={(e) => {
                    const nextType = e.target.value as QuickDestinationType;
                    setQuickComposeData(prev => ({
                      ...prev, destinationType: nextType,
                      recipientUserId: nextType === 'person' ? prev.recipientUserId : nextType === 'self' ? currentUserId : '',
                      recipientQuery: nextType === 'person' ? prev.recipientQuery : nextType === 'self' ? 'Me' : '',
                      visibility: nextType === 'home' ? 'home_members' : 'attn_only'
                    }));
                    setQuickRecipientDropdownOpen(false); setQuickRecipientActiveIndex(-1);
                  }}
                  className={COMPOSE_SELECT_CLASS}>
                  <option value="home">Home (Current Resident @ Address)</option>
                  <option value="self">Me @ Home</option>
                  <option value="person">Person @ Home</option>
                </select>
                <p className="text-xs text-app-text-secondary">
                  Visibility: {quickComposeData.destinationType === 'home' ? 'All home members' : quickComposeData.visibility === 'attn_plus_admins' ? 'Recipient + home admins' : 'Only selected person'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-app-text-secondary">Step 2 — Address Route</label>
                <AddressAutocomplete value={quickAddressInput}
                  onChange={(value) => setQuickAddressInput(value)}
                  onSelectNormalized={(normalized) => {
                    const matchedHome = matchHomeRouteFromAddress(normalized?.address || '');
                    if (matchedHome) { setQuickComposeData(prev => ({ ...prev, destinationHomeId: matchedHome.id })); setQuickAddressInput(matchedHome.label); }
                  }}
                  placeholder="Search an address"
                />
                {availableHomes.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">No home address found yet. Attach to a home to use address-routed delivery.</p>
                )}
              </div>

              {quickComposeData.destinationType === 'person' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-app-text-secondary">Step 3 — Attn Person</label>
                  <div className="relative" ref={quickRecipientContainerRef}>
                    <input type="text" placeholder="Search by name, username, or email" value={quickComposeData.recipientQuery}
                      onChange={(e) => handleQuickRecipientInputChange(e.target.value)} onKeyDown={handleQuickRecipientKeyDown}
                      onFocus={() => { if (quickComposeData.recipientQuery.trim().length >= 2) setQuickRecipientDropdownOpen(true); }}
                      onBlur={() => { window.setTimeout(() => setQuickRecipientDropdownOpen(false), 120); }}
                      className={COMPOSE_FIELD_CLASS}
                    />
                    {quickRecipientLoading && <p className="mt-1 text-xs text-app-text-secondary">Searching users...</p>}
                    {quickComposeData.recipientUserId && (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-app-text-secondary">Recipient ID: {quickComposeData.recipientUserId}</p>
                        <button type="button" onClick={handleCopyQuickRecipientId} className="text-[11px] text-blue-600 hover:text-blue-700">
                          {quickRecipientCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    {quickRecipientDropdownOpen && renderRecipientDropdown(
                      quickRecipientResults, quickRecipientLoading, quickComposeData.recipientQuery,
                      quickRecipientActiveIndex, setQuickRecipientActiveIndex, selectQuickRecipient
                    )}
                  </div>
                </div>
              )}

              {quickComposeData.destinationType === 'self' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  This mail will be delivered to your personal mailbox at the selected home route.
                </div>
              )}

              {quickComposeData.destinationType === 'home' ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-app-text-secondary">Attn label (optional)</label>
                  <input type="text" value={quickComposeData.attnLabel}
                    onChange={(e) => setQuickComposeData(prev => ({ ...prev, attnLabel: e.target.value }))}
                    placeholder="Current Resident" className={COMPOSE_FIELD_CLASS}
                  />
                  <p className="text-xs text-app-text-secondary">Visibility: All home members</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-app-text-secondary">Visibility</label>
                  <select value={quickComposeData.visibility}
                    onChange={(e) => setQuickComposeData(prev => ({ ...prev, visibility: e.target.value as MailDeliveryVisibility }))}
                    className={COMPOSE_SELECT_CLASS}>
                    <option value="attn_only">Only selected person</option>
                    <option value="attn_plus_admins">Selected person + home admins</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-app-text-secondary">Step 4 — Deliverable Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUICK_COMPOSE_TYPE_OPTIONS.map((typeKey) => {
                    const typeInfo = MAIL_TYPES[typeKey] || MAIL_TYPES.other;
                    const selected = quickComposeData.type === typeKey;
                    return (
                      <button key={typeKey} type="button"
                        onClick={() => setQuickComposeData(prev => ({ ...prev, type: typeKey }))}
                        className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                          selected ? 'bg-gray-900 text-white border-gray-900' : 'bg-app-surface text-app-text-strong border-app-border hover:bg-app-hover'
                        }`}>
                        <span className="mr-1">{typeInfo.icon}</span>
                        {typeInfo.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <input type="text" placeholder="Subject (optional)" value={quickComposeData.subject}
                onChange={(e) => setQuickComposeData(prev => ({ ...prev, subject: e.target.value }))}
                className={COMPOSE_FIELD_CLASS}
              />
              <textarea placeholder="Write your message..." value={quickComposeData.content}
                onChange={(e) => setQuickComposeData(prev => ({ ...prev, content: e.target.value }))}
                className={COMPOSE_TEXTAREA_CLASS}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-app-text-secondary">Build explicit envelope + object payload for digital-mail workflows.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['self', 'user', 'home'] as const).map((mode) => (
                  <button key={mode} type="button"
                    onClick={() => setStructuredComposeData(prev => ({ ...prev, recipientMode: mode }))}
                    className={`px-3 py-2 text-sm rounded-lg border transition capitalize ${
                      structuredComposeData.recipientMode === mode ? 'bg-gray-900 text-white border-gray-900' : 'bg-app-surface text-app-text-secondary border-app-border'
                    }`}>
                    {mode}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-app-text-secondary">Address (Home)</label>
                <AddressAutocomplete value={structuredAddressInput}
                  onChange={(value) => setStructuredAddressInput(value)}
                  onSelectNormalized={(normalized) => {
                    const matchedHome = matchHomeRouteFromAddress(normalized?.address || '');
                    if (matchedHome) { setStructuredComposeData(prev => ({ ...prev, recipientHomeId: matchedHome.id })); setStructuredAddressInput(matchedHome.label); }
                  }}
                  placeholder="Search an address"
                />
                {availableHomes.length === 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">No home address found yet. Attach to a home to use address-routed delivery.</p>
                )}
              </div>

              {structuredComposeData.recipientMode === 'user' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-app-text-secondary">Recipient User</label>
                  <div className="relative" ref={structuredRecipientContainerRef}>
                    <input type="text" placeholder="Search by name, username, or email" value={structuredComposeData.recipientQuery}
                      onChange={(e) => handleStructuredRecipientInputChange(e.target.value)} onKeyDown={handleStructuredRecipientKeyDown}
                      onFocus={() => { if (structuredComposeData.recipientQuery.trim().length >= 2) setStructuredRecipientDropdownOpen(true); }}
                      onBlur={() => { window.setTimeout(() => setStructuredRecipientDropdownOpen(false), 120); }}
                      className={COMPOSE_FIELD_CLASS}
                    />
                    {structuredRecipientLoading && <p className="mt-1 text-xs text-app-text-secondary">Searching users...</p>}
                    {structuredComposeData.recipientUserId && <p className="mt-1 text-xs text-app-text-secondary">Recipient ID: {structuredComposeData.recipientUserId}</p>}
                    {structuredRecipientDropdownOpen && renderRecipientDropdown(
                      structuredRecipientResults, structuredRecipientLoading, structuredComposeData.recipientQuery,
                      structuredRecipientActiveIndex, setStructuredRecipientActiveIndex, selectStructuredRecipient
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={structuredComposeData.type}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, type: e.target.value as MailType }))}
                  className={COMPOSE_SELECT_CLASS}>
                  {Object.entries(MAIL_TYPES).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
                </select>
                <select value={structuredComposeData.objectFormat}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, objectFormat: e.target.value as ObjectFormat }))}
                  className={COMPOSE_SELECT_CLASS}>
                  <option value="plain_text">Plain text</option>
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                </select>
              </div>

              <input type="text" placeholder="Subject" value={structuredComposeData.subject}
                onChange={(e) => setStructuredComposeData(prev => ({ ...prev, subject: e.target.value }))}
                className={COMPOSE_FIELD_CLASS}
              />
              <textarea placeholder="Object content..." value={structuredComposeData.content}
                onChange={(e) => setStructuredComposeData(prev => ({ ...prev, content: e.target.value }))}
                className={COMPOSE_TEXTAREA_CLASS}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Category (optional)" value={structuredComposeData.category}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, category: e.target.value }))}
                  className={COMPOSE_FIELD_CLASS}
                />
                <select value={structuredComposeData.priority}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, priority: e.target.value as StructuredComposeForm['priority'] }))}
                  className={COMPOSE_SELECT_CLASS}>
                  <option value="low">Low priority</option>
                  <option value="normal">Normal priority</option>
                  <option value="high">High priority</option>
                  <option value="urgent">Urgent priority</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Tags (comma-separated)" value={structuredComposeData.tags}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, tags: e.target.value }))}
                  className={COMPOSE_FIELD_CLASS}
                />
                <input type="number" min="0" max="10" step="0.01" placeholder="Payout amount (optional)" value={structuredComposeData.payoutAmount}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, payoutAmount: e.target.value }))}
                  className={COMPOSE_FIELD_CLASS}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="Sender business name (optional)" value={structuredComposeData.senderBusinessName}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, senderBusinessName: e.target.value }))}
                  className={COMPOSE_FIELD_CLASS}
                />
                <input type="text" placeholder="Sender address (optional)" value={structuredComposeData.senderAddress}
                  onChange={(e) => setStructuredComposeData(prev => ({ ...prev, senderAddress: e.target.value }))}
                  className={COMPOSE_FIELD_CLASS}
                />
              </div>
            </div>
          )}

          <div className="pt-1 flex items-center justify-end gap-2">
            <button type="button" onClick={handleClose}
              className="px-3 py-2 text-sm rounded-lg border border-app-border text-app-text-secondary hover:bg-app-hover">
              Cancel
            </button>
            <button type="submit" disabled={composeLoading}
              className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50">
              {composeLoading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
