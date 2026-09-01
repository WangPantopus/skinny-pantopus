// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { SharedResourceView } from '@pantopus/api';

// ============================================================
// Shared Resource Page — /shared/:token
// Public-facing page for scoped grant share links. No auth required.
// Shows a single shared resource (document, calendar event, etc.)
// ============================================================

type PageState = 'loading' | 'passcode' | 'expired' | 'revoked' | 'error' | 'success';

export default function SharedResourcePage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<SharedResourceView | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadResource = useCallback(async (code?: string) => {
    try {
      const res = await api.homeGuest.viewSharedResource(token, code);
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
    loadResource();
  }, [loadResource]);

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setPasscodeError('');
    setSubmitting(true);
    try {
      const res = await api.homeGuest.viewSharedResource(token, passcode.trim());
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

  // ---- Loading ----
  if (state === 'loading') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4 animate-pulse">🔗</div>
          <div className="w-8 h-8 border-2 border-app-border border-t-gray-700 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-app-text-secondary">Loading shared content...</p>
        </div>
      </PageShell>
    );
  }

  // ---- Passcode ----
  if (state === 'passcode') {
    return (
      <PageShell>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Passcode Required</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            Enter the passcode to view this shared content.
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

  // ---- Expired ----
  if (state === 'expired') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Link Expired</h1>
          <p className="text-sm text-app-text-secondary mb-6 max-w-xs mx-auto">
            This shared link has expired. Contact the person who shared it to request a new one.
          </p>
          <a
            href="mailto:?"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-app-border rounded-xl text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Request New Link
          </a>
        </div>
      </PageShell>
    );
  }

  // ---- Revoked ----
  if (state === 'revoked') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Access Revoked</h1>
          <p className="text-sm text-app-text-secondary max-w-xs mx-auto">
            This shared link is no longer active. It was revoked by the owner.
          </p>
        </div>
      </PageShell>
    );
  }

  // ---- Error ----
  if (state === 'error') {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-semibold text-app-text mb-1">Something Went Wrong</h1>
          <p className="text-sm text-app-text-secondary mb-6 max-w-xs mx-auto">
            {errorMsg || 'We couldn\'t load this shared content. The link may be invalid.'}
          </p>
          <button
            onClick={() => { setState('loading'); loadResource(); }}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
          >
            Try Again
          </button>
        </div>
      </PageShell>
    );
  }

  // ---- Success ----
  if (!data) return null;

  const { grant, resource } = data;

  return (
    <PageShell>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">
          {RESOURCE_ICON[grant.resource_type] || '📎'}
        </div>
        <h1 className="text-xl font-semibold text-app-text">
          {resource.title || resource.label || resource.name || 'Shared Content'}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted bg-app-surface-sunken px-2 py-0.5 rounded-full">
            Shared {RESOURCE_LABEL[grant.resource_type] || grant.resource_type}
          </span>
          {grant.can_edit && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Can Edit
            </span>
          )}
        </div>
        {grant.expires_at && (
          <ExpiryBadge expiresAt={grant.expires_at} />
        )}
      </div>

      {/* Resource content */}
      <div className="bg-app-surface rounded-xl border border-app-border p-5 shadow-sm">
        <SharedResourceContent type={grant.resource_type} resource={resource} />
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
// Constants
// ============================================================

const RESOURCE_ICON: Record<string, string> = {
  document: '📄',
  task: '📋',
  bill: '💰',
  event: '📅',
  issue: '🔧',
  package: '📦',
  pet: '🐾',
  poll: '📊',
  access_secret: '🔑',
  emergency: '🚨',
};

const RESOURCE_LABEL: Record<string, string> = {
  document: 'Document',
  task: 'Task',
  bill: 'Bill',
  event: 'Event',
  issue: 'Issue',
  package: 'Package',
  pet: 'Pet Info',
  poll: 'Poll',
  access_secret: 'Access Info',
  emergency: 'Emergency Info',
};

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

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('Expired');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setLabel(`Expires in ${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setLabel(`Expires in ${hours}h ${minutes}m`);
      } else {
        setLabel(`Expires in ${minutes}m`);
      }
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = label === 'Expired';
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      isExpired ? 'text-red-600 bg-red-50' : 'text-amber-700 bg-amber-50'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
      {label}
    </div>
  );
}

// ---- Render different resource types ----

function SharedResourceContent({ type, resource }: { type: string; resource: Record<string, any> }) {
  switch (type) {
    case 'document':
      return <DocumentView resource={resource} />;
    case 'task':
      return <TaskView resource={resource} />;
    case 'bill':
      return <BillView resource={resource} />;
    case 'event':
      return <EventView resource={resource} />;
    case 'issue':
      return <IssueView resource={resource} />;
    case 'package':
      return <PackageView resource={resource} />;
    default:
      return <GenericView resource={resource} />;
  }
}

function DocumentView({ resource }: { resource: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-medium text-app-text-muted uppercase tracking-wider mb-1">Document</div>
        <div className="text-lg font-semibold text-app-text">{resource.title || resource.filename || 'Untitled'}</div>
      </div>
      {resource.description && (
        <p className="text-sm text-app-text-secondary whitespace-pre-wrap">{resource.description}</p>
      )}
      {resource.file_type && (
        <div className="text-xs text-app-text-secondary">Type: {resource.file_type.toUpperCase()}</div>
      )}
      {resource.url && (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download
        </a>
      )}
    </div>
  );
}

function TaskView({ resource }: { resource: Record<string, any> }) {
  const statusColors: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-amber-50 text-amber-700',
    done: 'bg-green-50 text-green-700',
    canceled: 'bg-app-surface-sunken text-app-text-secondary',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-lg font-semibold text-app-text">{resource.title || 'Untitled Task'}</div>
        {resource.status && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
            statusColors[resource.status] || 'bg-app-surface-sunken text-app-text-secondary'
          }`}>
            {resource.status.replace('_', ' ')}
          </span>
        )}
      </div>
      {resource.description && (
        <p className="text-sm text-app-text-secondary whitespace-pre-wrap">{resource.description}</p>
      )}
      <div className="flex flex-wrap gap-3 text-xs text-app-text-secondary">
        {resource.priority && <span>Priority: <strong className="text-app-text-strong capitalize">{resource.priority}</strong></span>}
        {resource.due_at && <span>Due: <strong className="text-app-text-strong">{new Date(resource.due_at).toLocaleDateString()}</strong></span>}
        {resource.assigned_to_name && <span>Assigned: <strong className="text-app-text-strong">{resource.assigned_to_name}</strong></span>}
      </div>
    </div>
  );
}

function BillView({ resource }: { resource: Record<string, any> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-app-text">{resource.provider_name || resource.bill_type || 'Bill'}</div>
          {resource.bill_type && <div className="text-xs text-app-text-secondary capitalize">{resource.bill_type.replace('_', ' ')}</div>}
        </div>
        {resource.amount != null && (
          <div className="text-xl font-bold text-app-text">${Number(resource.amount).toFixed(2)}</div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-app-text-secondary">
        {resource.due_date && <span>Due: <strong className="text-app-text-strong">{new Date(resource.due_date).toLocaleDateString()}</strong></span>}
        {resource.status && <span>Status: <strong className="text-app-text-strong capitalize">{resource.status}</strong></span>}
      </div>
    </div>
  );
}

function EventView({ resource }: { resource: Record<string, any> }) {
  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold text-app-text">{resource.title || 'Event'}</div>
      {resource.description && (
        <p className="text-sm text-app-text-secondary whitespace-pre-wrap">{resource.description}</p>
      )}
      <div className="bg-app-surface-raised rounded-lg p-3 space-y-1.5">
        {resource.start_at && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-app-text-muted">Start:</span>
            <span className="font-medium text-app-text">{formatDateTime(resource.start_at)}</span>
          </div>
        )}
        {resource.end_at && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-app-text-muted">End:</span>
            <span className="font-medium text-app-text">{formatDateTime(resource.end_at)}</span>
          </div>
        )}
      </div>
      {resource.event_type && (
        <div className="text-xs text-app-text-secondary">Type: <span className="capitalize">{resource.event_type.replace('_', ' ')}</span></div>
      )}
    </div>
  );
}

function IssueView({ resource }: { resource: Record<string, any> }) {
  const severityColors: Record<string, string> = {
    low: 'bg-app-surface-sunken text-app-text-secondary',
    medium: 'bg-amber-50 text-amber-700',
    high: 'bg-orange-50 text-orange-700',
    critical: 'bg-red-50 text-red-700',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-lg font-semibold text-app-text">{resource.title || 'Issue'}</div>
        {resource.severity && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${
            severityColors[resource.severity] || 'bg-app-surface-sunken text-app-text-secondary'
          }`}>
            {resource.severity}
          </span>
        )}
      </div>
      {resource.description && (
        <p className="text-sm text-app-text-secondary whitespace-pre-wrap">{resource.description}</p>
      )}
      {resource.status && (
        <div className="text-xs text-app-text-secondary">Status: <strong className="text-app-text-strong capitalize">{resource.status.replace('_', ' ')}</strong></div>
      )}
    </div>
  );
}

function PackageView({ resource }: { resource: Record<string, any> }) {
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold text-app-text">{resource.description || resource.vendor_name || 'Package'}</div>
      <div className="flex flex-wrap gap-3 text-xs text-app-text-secondary">
        {resource.carrier && <span>Carrier: <strong className="text-app-text-strong">{resource.carrier}</strong></span>}
        {resource.tracking_number && <span>Tracking: <strong className="text-app-text-strong font-mono">{resource.tracking_number}</strong></span>}
        {resource.status && <span>Status: <strong className="text-app-text-strong capitalize">{resource.status.replace('_', ' ')}</strong></span>}
        {resource.expected_at && <span>Expected: <strong className="text-app-text-strong">{new Date(resource.expected_at).toLocaleDateString()}</strong></span>}
      </div>
    </div>
  );
}

function GenericView({ resource }: { resource: Record<string, any> }) {
  // Render known fields nicely, fall back to JSON for unknown
  const knownFields = ['title', 'name', 'label', 'description', 'notes', 'status'];
  const hasKnownFields = knownFields.some((f) => resource[f]);

  if (hasKnownFields) {
    return (
      <div className="space-y-3">
        {(resource.title || resource.name || resource.label) && (
          <div className="text-lg font-semibold text-app-text">
            {resource.title || resource.name || resource.label}
          </div>
        )}
        {resource.description && (
          <p className="text-sm text-app-text-secondary whitespace-pre-wrap">{resource.description}</p>
        )}
        {resource.notes && (
          <p className="text-sm text-app-text-secondary italic">{resource.notes}</p>
        )}
        {resource.status && (
          <div className="text-xs text-app-text-secondary">Status: <strong className="text-app-text-strong capitalize">{resource.status}</strong></div>
        )}
      </div>
    );
  }

  // Fallback: formatted key-value list
  return (
    <div className="space-y-2">
      {Object.entries(resource)
        .filter(([, v]) => v != null && v !== '')
        .slice(0, 20)
        .map(([key, value]) => (
          <div key={key} className="flex items-start gap-3">
            <span className="text-xs font-medium text-app-text-muted w-28 shrink-0 capitalize">{key.replace(/_/g, ' ')}</span>
            <span className="text-sm text-app-text-strong break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
    </div>
  );
}
