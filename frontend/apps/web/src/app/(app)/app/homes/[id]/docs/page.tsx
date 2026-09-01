'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Image as ImageIcon, ShieldCheck, Award, BookOpen, Receipt, FolderOpen, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';

const FOLDER_ICONS: Record<string, typeof FileText> = {
  lease: FileText, insurance: ShieldCheck, warranty: Award,
  manual: BookOpen, receipt: Receipt, photo: ImageIcon, other: FolderOpen,
};

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function DocsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchDocs = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomeDocuments(homeId);
      setDocs((res as any)?.documents || []);
    } catch { toast.error('Failed to load documents'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchDocs().finally(() => setLoading(false)); }, [fetchDocs]);

  const handleDelete = useCallback(async (docId: string, title: string) => {
    const yes = await confirmStore.open({ title: 'Delete Document', description: `Remove "${title}"?`, confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    toast.success('Document removed');
  }, []);

  // Group by folder
  const grouped = docs.reduce<Record<string, any[]>>((acc, doc) => {
    const folder = doc.folder || 'other';
    (acc[folder] = acc[folder] || []).push(doc);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Documents</h1>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No documents uploaded</p>
          <p className="text-xs text-app-text-muted mt-1">Upload documents from the home dashboard</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([folder, folderDocs]) => {
            const Icon = FOLDER_ICONS[folder] || FolderOpen;
            return (
              <div key={folder}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-app-text-secondary" />
                  <h2 className="text-sm font-bold text-app-text-strong flex-1">{folder.charAt(0).toUpperCase() + folder.slice(1)}</h2>
                  <span className="text-xs text-app-text-muted bg-app-surface-sunken px-2 py-0.5 rounded-full">{folderDocs.length}</span>
                </div>
                <div className="space-y-1.5">
                  {folderDocs.map((doc: any) => {
                    const DocIcon = doc.mime_type?.startsWith('image/') ? ImageIcon : FileText;
                    return (
                      <div key={doc.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-lg p-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <DocIcon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-app-text truncate">{doc.title || doc.filename || 'Untitled'}</p>
                          <div className="flex gap-2 mt-0.5">
                            {doc.file_size && <span className="text-[11px] text-app-text-muted">{formatSize(doc.file_size)}</span>}
                            {doc.created_at && <span className="text-[11px] text-app-text-muted">{new Date(doc.created_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        {doc.file_url && (
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 font-medium hover:underline flex-shrink-0">
                            View
                          </a>
                        )}
                        <button onClick={() => handleDelete(doc.id, doc.title || doc.filename)} className="p-1 text-app-text-muted hover:text-red-500 transition flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() { return <Suspense><DocsContent /></Suspense>; }
