'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, AlertCircle, CalendarDays, Wrench, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type MaintTab = 'open' | 'scheduled' | 'history';

const STATUS_META: Record<string, { icon: typeof AlertCircle; color: string; label: string }> = {
  suggested:   { icon: AlertCircle,  color: '#f59e0b', label: 'Open' },
  open:        { icon: AlertCircle,  color: '#f59e0b', label: 'Open' },
  scheduled:   { icon: CalendarDays, color: '#0284c7', label: 'Scheduled' },
  in_progress: { icon: Wrench,       color: '#7c3aed', label: 'In Progress' },
  completed:   { icon: CheckCircle,  color: '#16a34a', label: 'Completed' },
  dismissed:   { icon: XCircle,      color: '#6b7280', label: 'Dismissed' },
};

function MaintenanceContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MaintTab>('open');
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchItems = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomeIssues(homeId);
      setItems((res as any)?.issues || []);
    } catch { toast.error('Failed to load maintenance items'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchItems().finally(() => setLoading(false)); }, [fetchItems]);

  const openItems = items.filter((i) => i.status === 'suggested' || i.status === 'open');
  const scheduledItems = items.filter((i) => i.status === 'scheduled' || i.status === 'in_progress');
  const historyItems = items.filter((i) => i.status === 'completed' || i.status === 'dismissed');
  const currentList = tab === 'open' ? openItems : tab === 'scheduled' ? scheduledItems : historyItems;

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await api.homeProfile.createHomeIssue(homeId!, { title: newTitle.trim(), description: newDesc.trim() || undefined });
      setNewTitle(''); setNewDesc(''); setShowCreate(false);
      toast.success('Issue reported');
      await fetchItems();
    } catch (err: any) { toast.error(err?.message || 'Failed to create issue'); }
    finally { setCreating(false); }
  }, [homeId, newTitle, newDesc, fetchItems]);

  const updateStatus = useCallback(async (itemId: string, status: string) => {
    try { await api.homeProfile.updateHomeIssue(homeId!, itemId, { status }); await fetchItems(); }
    catch { toast.error('Failed to update issue'); }
  }, [homeId, fetchItems]);

  const handleDismiss = useCallback(async (itemId: string) => {
    const yes = await confirmStore.open({ title: 'Dismiss Issue', description: 'Are you sure?', confirmLabel: 'Dismiss', variant: 'destructive' });
    if (!yes) return;
    try { await api.homeProfile.updateHomeIssue(homeId!, itemId, { status: 'dismissed' }); toast.success('Issue dismissed'); await fetchItems(); }
    catch { toast.error('Failed to dismiss issue'); }
  }, [homeId, fetchItems]);

  const TABS: { key: MaintTab; label: string; count: number }[] = [
    { key: 'open', label: 'Open', count: openItems.length },
    { key: 'scheduled', label: 'Scheduled', count: scheduledItems.length },
    { key: 'history', label: 'History', count: historyItems.length },
  ];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Maintenance</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Report Issue
        </button>
      </div>

      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Issue title" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          <button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Reporting...' : 'Report Issue'}
          </button>
        </div>
      )}

      <div className="flex border-b border-app-border mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium transition ${tab === t.key ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-app-text-secondary hover:text-app-text'}`}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {currentList.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">{tab === 'open' ? 'No open issues' : tab === 'scheduled' ? 'Nothing scheduled' : 'No history'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentList.map((item) => {
            const meta = STATUS_META[item.status || 'open'] || STATUS_META.open;
            const StatusIcon = meta.icon;
            return (
              <div key={item.id} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <div className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: meta.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app-text">{item.title}</p>
                  {item.description && <p className="text-xs text-app-text-secondary mt-1 line-clamp-2">{item.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ color: meta.color, backgroundColor: meta.color + '15' }}>
                      <StatusIcon className="w-3 h-3" />{meta.label}
                    </span>
                    {item.updated_at && <span className="text-xs text-app-text-muted">{new Date(item.updated_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {(item.status === 'suggested' || item.status === 'open') && (
                    <button onClick={() => updateStatus(item.id, 'scheduled')} title="Schedule" className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition">
                      <CalendarDays className="w-4 h-4" />
                    </button>
                  )}
                  {item.status === 'scheduled' && (
                    <button onClick={() => updateStatus(item.id, 'completed')} title="Mark complete" className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDismiss(item.id)} title="Dismiss" className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MaintenancePage() { return <Suspense><MaintenanceContent /></Suspense>; }
