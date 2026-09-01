'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { Scroll, ShieldCheck, BookOpen, Receipt, Building2, Folder, FolderOpen, ChevronLeft } from 'lucide-react';
import * as api from '@pantopus/api';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';
import { toast } from '@/components/ui/toast-store';

const DOC_FOLDERS: { key: string; label: string; icon: ReactNode; types: string[] }[] = [
  { key: 'lease', label: 'Lease / Title', icon: <Scroll className="w-4 h-4" />, types: ['lease', 'title', 'deed', 'rental_agreement'] },
  { key: 'insurance', label: 'Insurance', icon: <ShieldCheck className="w-4 h-4" />, types: ['insurance', 'policy'] },
  { key: 'warranties', label: 'Warranties & Manuals', icon: <BookOpen className="w-4 h-4" />, types: ['warranty', 'manual', 'guide'] },
  { key: 'receipts', label: 'Receipts', icon: <Receipt className="w-4 h-4" />, types: ['receipt', 'invoice'] },
  { key: 'hoa', label: 'HOA', icon: <Building2 className="w-4 h-4" />, types: ['hoa', 'bylaws', 'minutes'] },
  { key: 'other', label: 'Other', icon: <Folder className="w-4 h-4" />, types: [] },
];

// ---- Preview ----

export function DocsCardPreview({
  documents,
  onExpand,
}: {
  documents: Record<string, any>[];
  onExpand: () => void;
}) {
  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      const folder = DOC_FOLDERS.find((f) => f.types.includes(d.doc_type)) || DOC_FOLDERS[DOC_FOLDERS.length - 1];
      counts[folder.key] = (counts[folder.key] || 0) + 1;
    });
    return counts;
  }, [documents]);

  return (
    <DashboardCard
      title="Documents"
      icon={<Folder className="w-5 h-5" />}
      visibility="members"
      count={documents.length}
      onClick={onExpand}
    >
      {documents.length > 0 ? (
        <div className="space-y-1">
          {DOC_FOLDERS.filter((f) => byType[f.key]).map((f) => (
            <div key={f.key} className="flex items-center justify-between text-sm">
              <span className="text-app-text-secondary truncate flex items-center gap-1.5">
                {f.icon} {f.label}
              </span>
              <span className="text-xs text-app-text-muted">{byType[f.key]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><Folder className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No documents</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function DocsCard({
  documents,
  homeId,
  onBack,
  highlightDocumentId,
}: {
  documents: Record<string, any>[];
  homeId: string;
  onBack: () => void;
  highlightDocumentId?: string;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, Record<string, any>[]> = {};
    DOC_FOLDERS.forEach((f) => { groups[f.key] = []; });

    documents.forEach((doc) => {
      const folder = DOC_FOLDERS.find((f) => f.types.includes(doc.doc_type));
      const key = folder ? folder.key : 'other';
      groups[key].push(doc);
    });

    return groups;
  }, [documents]);

  const handleShare = async (doc: Record<string, any>) => {
    try {
      const res = await api.homeIam.createScopedGrant(homeId, {
        resource_type: 'document',
        resource_id: doc.id,
        permission_scope: 'read',
      });
      const resData = res as { grant?: { token?: string }; token?: string };
      const shareUrl = `${window.location.origin}/shared/${resData.grant?.token || resData.token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create share link');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Folder className="w-5 h-5" /> Documents</h2>
        </div>
      </div>

      {DOC_FOLDERS.map((folder) => {
        const docs = grouped[folder.key];
        if (docs.length === 0) return null;

        return (
          <div key={folder.key}>
            <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              {folder.icon} {folder.label} ({docs.length})
            </h3>
            <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
              {docs.map((doc) => {
                const sourceMailId = doc?.details?.sourceMailId || doc?.details?.source_mail_id || null;
                return (
                  <div
                    key={doc.id}
                    id={`doc-${doc.id}`}
                    className={`px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition ${
                      doc.id === highlightDocumentId ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-app-text">{doc.title || 'Document'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {doc.doc_type && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary capitalize">
                            {doc.doc_type.replace('_', ' ')}
                          </span>
                        )}
                        <span className="text-[10px] text-app-text-muted">
                          {doc.created_at && new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        {doc.visibility && <VisibilityChip visibility={doc.visibility} />}
                        {sourceMailId && (
                          <Link
                            href={`/app/mailbox/${sourceMailId}?scope=home&homeId=${homeId}`}
                            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            From Mail
                          </Link>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleShare(doc)}
                      className="text-app-text-muted hover:text-blue-500 transition flex-shrink-0"
                      title="Create share link"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {documents.length === 0 && (
        <div className="bg-app-surface rounded-xl border border-app-border p-8 text-center">
          <div className="mb-2"><FolderOpen className="w-8 h-8 mx-auto text-app-text-muted" /></div>
          <p className="text-sm text-app-text-secondary">No documents uploaded yet</p>
        </div>
      )}
    </div>
  );
}
