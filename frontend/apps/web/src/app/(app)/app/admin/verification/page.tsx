'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { formatTimeAgo } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type QueueItem = api.admin.VerificationQueueItem;

const EVIDENCE_LABELS: Record<string, string> = {
  business_license: 'Business license',
  ein_letter: 'EIN letter',
  utility_bill: 'Utility bill',
  state_registration: 'State registration',
  ein_verification: 'EIN verification',
  tax_exempt_letter: 'Tax-exempt letter',
};

function businessLabel(item: QueueItem) {
  const b = item.business;
  if (!b) return 'Unknown business';
  if (b.name && b.username) return `${b.name} (@${b.username})`;
  return b.name || (b.username ? `@${b.username}` : 'Unnamed business');
}

// Documents businesses submit for a Verified badge. Only platform admins can approve them;
// the server refuses everyone else, and this page says so.
export default function AdminVerificationPage() {
  const router = useRouter();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [denied, setDenied] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchQueue = useCallback(async () => {
    try {
      const result = await api.admin.getVerificationQueue();
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; status?: number } | null;
      if (e?.statusCode === 403 || e?.status === 403) {
        setDenied(true);
        return;
      }
      toast.error('Failed to load documents');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchQueue().finally(() => setLoading(false));
  }, [fetchQueue]);

  const review = async (item: QueueItem, decision: 'approve' | 'reject') => {
    if (acting) return;
    if (decision === 'reject') {
      const confirmed = await confirmStore.open({
        title: 'Reject this document?',
        description: 'The business stays at its current verification level and can upload another document.',
        confirmLabel: 'Reject',
        variant: 'destructive',
      });
      if (!confirmed) return;
    }
    setActing(item.id);
    try {
      await api.admin.reviewVerificationEvidence(item.id, decision, notes[item.id]?.trim() || undefined);
      toast.success(decision === 'approve' ? 'Approved: the business is document verified' : 'Rejected');
      setItems((list) => list.filter((i) => i.id !== item.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err: unknown) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to save the review');
      fetchQueue();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border bg-app-surface">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition" aria-label="Back"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text flex-1">Business verification</h1>
        {!denied && (
          <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[24px] text-center" data-testid="admin-verification-count">{total}</span>
        )}
        <button onClick={() => { setLoading(true); fetchQueue().finally(() => setLoading(false)); }} className="p-1.5 hover:bg-app-hover rounded-lg transition" aria-label="Refresh">
          <RefreshCw className={`w-4.5 h-4.5 text-app-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {denied ? (
          <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="admin-verification-denied">
            <ShieldAlert className="w-14 h-14 text-app-text-muted mb-4" />
            <p className="text-lg font-semibold text-app-text">Admins only</p>
            <p className="text-sm text-app-text-secondary mt-1">You do not have admin access.</p>
            <Link href="/app" className="mt-4 px-4 py-2 rounded-lg text-sm font-medium border border-app-border text-app-text hover:bg-app-hover transition">
              Back to Pantopus
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <CheckCircle className="w-14 h-14 text-emerald-500 mb-4" />
            <p className="text-lg font-semibold text-app-text">All caught up!</p>
            <p className="text-sm text-app-text-secondary mt-1">No documents waiting for review</p>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="admin-verification-list">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-app-border bg-app-surface p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {EVIDENCE_LABELS[item.evidence_type] || item.evidence_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-app-text-muted ml-auto">Submitted {formatTimeAgo(item.created_at)}</span>
                </div>
                <p className="text-sm font-medium text-app-text">{businessLabel(item)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.document_url ? (
                    <a
                      href={item.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-app-border text-app-text hover:bg-app-hover transition"
                    >
                      <FileText className="w-4 h-4" />View document
                    </a>
                  ) : (
                    <span className="text-xs text-app-text-muted">The document is no longer available.</span>
                  )}
                  {item.business?.username && (
                    <Link href={`/b/${item.business.username}`} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-app-border text-app-text hover:bg-app-hover transition">
                      Open business page
                    </Link>
                  )}
                </div>
                <label className="block mt-3">
                  <span className="text-xs text-app-text-secondary">Note to the business (optional)</span>
                  <input
                    value={notes[item.id] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                    maxLength={500}
                    className="mt-1 w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text"
                  />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => review(item, 'approve')}
                    disabled={acting === item.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review(item, 'reject')}
                    disabled={acting === item.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium text-app-text-secondary hover:bg-app-hover disabled:opacity-50 transition"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
