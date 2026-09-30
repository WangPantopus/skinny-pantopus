'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Flag, RefreshCw } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { formatTimeAgo } from '@pantopus/ui-utils';
import { toast } from '@/components/ui/toast-store';

type AdminReport = api.admin.AdminReport;
type ReportStatus = api.admin.ReportStatus;
type ReportPerson = api.admin.ReportPerson;

const KIND_LABELS: Record<string, string> = { user: 'Person', post: 'Post', gig: 'Task', message: 'Neighbor message' };
const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate',
  misinformation: 'Misinformation',
  safety: 'Safety',
  other: 'Other',
};
const TABS: { status: ReportStatus; label: string }[] = [
  { status: 'pending', label: 'To review' },
  { status: 'resolved', label: 'Resolved' },
  { status: 'dismissed', label: 'Dismissed' },
];

function personLabel(p: ReportPerson | null | undefined) {
  if (!p) return 'Unknown account';
  if (p.name && p.username) return `${p.name} (@${p.username})`;
  return p.name || (p.username ? `@${p.username}` : 'Unnamed account');
}

function targetHref(report: AdminReport): string | null {
  if (report.kind === 'message') return null;
  if (report.kind === 'post') return `/app/feed/post/${report.target_id}`;
  if (report.kind === 'gig') return `/app/gigs/${report.target_id}`;
  const username = (report.target as ReportPerson | null)?.username;
  return username ? `/${username}` : null;
}

function TargetSummary({ report }: { report: AdminReport }) {
  const t = report.target as Record<string, any> | null;
  if (!t) return <p className="text-sm text-app-text-secondary">This {KIND_LABELS[report.kind].toLowerCase()} no longer exists.</p>;
  if (report.kind === 'user') return <p className="text-sm font-medium text-app-text">{personLabel(t as ReportPerson)}</p>;
  const by = report.kind === 'gig' ? t.poster : t.author;
  return (
    <div className="space-y-1">
      {t.title && <p className="text-sm font-medium text-app-text">{String(t.title).replace(/_/g, ' ')}</p>}
      {t.excerpt && <p className="text-sm text-app-text-secondary line-clamp-3">{t.excerpt}</p>}
      <p className="text-xs text-app-text-muted">
        {report.kind === 'message' ? 'Sent by ' : 'Posted by '}{personLabel(by)}
        {t.archived ? ' · archived' : ''}
        {t.status ? ` · ${String(t.status).replace(/_/g, ' ')}` : ''}
      </p>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchReports = useCallback(async () => {
    try {
      const result = await api.admin.getReports(status);
      setReports(result.reports || []);
      setTotal(result.total || 0);
    } catch (err: any) {
      if (err?.statusCode === 403 || err?.status === 403) {
        toast.error('You do not have admin access.');
        router.back();
        return;
      }
      toast.error('Failed to load reports');
    }
  }, [router, status]);

  useEffect(() => {
    setLoading(true);
    fetchReports().finally(() => setLoading(false));
  }, [fetchReports]);

  const closeReport = async (report: AdminReport, outcome: 'resolved' | 'dismissed') => {
    if (acting) return;
    setActing(`${report.kind}:${report.id}`);
    try {
      await api.admin.resolveReport(report.kind, report.id, outcome);
      toast.success(outcome === 'resolved' ? 'Marked resolved' : 'Dismissed');
      setReports((list) => list.filter((r) => !(r.kind === report.kind && r.id === report.id)));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update the report');
      fetchReports();
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="min-h-screen bg-app-surface">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border bg-app-surface">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition" aria-label="Back"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text flex-1">Reports</h1>
        {status === 'pending' && (
          <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full min-w-[24px] text-center" data-testid="admin-reports-count">{total}</span>
        )}
        <button onClick={() => { setLoading(true); fetchReports().finally(() => setLoading(false)); }} className="p-1.5 hover:bg-app-hover rounded-lg transition" aria-label="Refresh">
          <RefreshCw className={`w-4.5 h-4.5 text-app-text-secondary ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        <div className="flex gap-2 mb-4" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.status}
              role="tab"
              aria-selected={status === tab.status}
              onClick={() => setStatus(tab.status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${status === tab.status ? 'bg-violet-600 text-white' : 'text-app-text-secondary hover:bg-app-hover'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24"><div className="animate-spin h-8 w-8 border-3 border-violet-600 border-t-transparent rounded-full" /></div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <CheckCircle className="w-14 h-14 text-emerald-500 mb-4" />
            <p className="text-lg font-semibold text-app-text">{status === 'pending' ? 'All caught up!' : 'Nothing here yet'}</p>
            <p className="text-sm text-app-text-secondary mt-1">{status === 'pending' ? 'No reports to review' : `No ${status} reports`}</p>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="admin-reports-list">
            {reports.map((report) => {
              const key = `${report.kind}:${report.id}`;
              const href = targetHref(report);
              return (
                <li key={key} className="rounded-xl border border-app-border bg-app-surface p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-slate-100 text-slate-700">{KIND_LABELS[report.kind]}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-1 rounded bg-red-50 text-red-700">
                      <Flag className="w-3 h-3" />{REASON_LABELS[report.reason] || report.reason}
                    </span>
                    <span className="text-xs text-app-text-muted ml-auto">{formatTimeAgo(report.created_at)}</span>
                  </div>
                  <TargetSummary report={report} />
                  {report.details && (
                    <p className="mt-2 text-sm text-app-text whitespace-pre-wrap rounded-lg bg-app-surface-sunken px-3 py-2">{report.details}</p>
                  )}
                  <p className="mt-2 text-xs text-app-text-muted">Reported by {personLabel(report.reporter)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {href && (
                      <Link href={href} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-app-border text-app-text hover:bg-app-hover transition">
                        Open {KIND_LABELS[report.kind].toLowerCase()}
                      </Link>
                    )}
                    {status === 'pending' && !report.closable && (
                      <span className="text-xs text-app-text-muted">Neighbor-message reports can’t be closed here yet.</span>
                    )}
                    {status === 'pending' && report.closable && (
                      <>
                        <button
                          onClick={() => closeReport(report, 'resolved')}
                          disabled={acting === key}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition"
                        >
                          Resolved
                        </button>
                        <button
                          onClick={() => closeReport(report, 'dismissed')}
                          disabled={acting === key}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium text-app-text-secondary hover:bg-app-hover disabled:opacity-50 transition"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    {status !== 'pending' && report.resolved_at && (
                      <span className="text-xs text-app-text-muted">Closed {formatTimeAgo(report.resolved_at)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
