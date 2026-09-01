'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Package, Plane, CheckCircle, Archive, Hand, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

type PkgTab = 'expected' | 'delivered' | 'archived';

const STATUS_ICON: Record<string, { icon: typeof Package; color: string }> = {
  expected:   { icon: Package,     color: '#f59e0b' },
  in_transit: { icon: Plane,       color: '#0284c7' },
  delivered:  { icon: CheckCircle, color: '#16a34a' },
  picked_up:  { icon: Archive,     color: '#6b7280' },
};

function PackagesContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PkgTab>('expected');
  const [showCreate, setShowCreate] = useState(false);

  const [newDesc, setNewDesc] = useState('');
  const [newCarrier, setNewCarrier] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchPackages = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomePackages(homeId);
      setPackages((res as any)?.packages || []);
    } catch { toast.error('Failed to load packages'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchPackages().finally(() => setLoading(false)); }, [fetchPackages]);

  const expected  = packages.filter((p) => p.status === 'expected' || p.status === 'in_transit');
  const delivered = packages.filter((p) => p.status === 'delivered');
  const archived  = packages.filter((p) => p.status === 'picked_up' || p.status === 'archived');
  const currentList = tab === 'expected' ? expected : tab === 'delivered' ? delivered : archived;

  const markPickedUp = useCallback(async (pkgId: string) => {
    try {
      await api.homeProfile.updateHomePackage(homeId!, pkgId, { status: 'picked_up' });
      toast.success('Marked as picked up');
      await fetchPackages();
    } catch { toast.error('Failed to update package'); }
  }, [homeId, fetchPackages]);

  const handleCreate = useCallback(async () => {
    if (!newDesc.trim()) return;
    setCreating(true);
    try {
      await api.homeProfile.createHomePackage(homeId!, { description: newDesc.trim(), carrier: newCarrier.trim() || undefined });
      setNewDesc(''); setNewCarrier(''); setShowCreate(false);
      toast.success('Package logged');
      await fetchPackages();
    } catch (err: any) { toast.error(err?.message || 'Failed to log package'); }
    finally { setCreating(false); }
  }, [homeId, newDesc, newCarrier, fetchPackages]);

  const handleDelete = useCallback(async (pkgId: string) => {
    const yes = await confirmStore.open({ title: 'Delete Package', description: 'Are you sure?', confirmLabel: 'Delete', variant: 'destructive' });
    if (!yes) return;
    try { await api.homeProfile.updateHomePackage(homeId!, pkgId, { status: 'returned' }); toast.success('Package removed'); await fetchPackages(); }
    catch { toast.error('Failed to delete package'); }
  }, [homeId, fetchPackages]);

  const TABS: { key: PkgTab; label: string; count: number }[] = [
    { key: 'expected', label: 'Expected', count: expected.length },
    { key: 'delivered', label: 'Delivered', count: delivered.length },
    { key: 'archived', label: 'Archived', count: archived.length },
  ];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Deliveries</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Log Package
        </button>
      </div>

      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Package description" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <input type="text" value={newCarrier} onChange={(e) => setNewCarrier(e.target.value)} placeholder="Carrier (optional)" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <button onClick={handleCreate} disabled={creating || !newDesc.trim()} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Logging...' : 'Log Package'}
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
        <div className="text-center py-16"><Package className="w-10 h-10 mx-auto text-app-text-muted mb-3" /><p className="text-sm text-app-text-secondary">No packages here</p></div>
      ) : (
        <div className="space-y-2">
          {currentList.map((pkg) => {
            const si = STATUS_ICON[pkg.status] || STATUS_ICON.expected;
            const Icon = si.icon;
            return (
              <div key={pkg.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <Icon className="w-5 h-5 flex-shrink-0" style={{ color: si.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app-text">{pkg.description || 'Package'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {pkg.carrier && <span className="text-xs text-app-text-secondary font-medium">{pkg.carrier}</span>}
                    {pkg.expected_at && <span className="text-xs text-app-text-muted">Expected {new Date(pkg.expected_at).toLocaleDateString()}</span>}
                    {pkg.delivered_at && <span className="text-xs text-app-text-muted">Delivered {new Date(pkg.delivered_at).toLocaleDateString()}</span>}
                  </div>
                  {pkg.tracking_number && <p className="text-[11px] text-app-text-muted mt-1 font-mono">#{pkg.tracking_number}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {pkg.status === 'delivered' && (
                    <button onClick={() => markPickedUp(pkg.id)} title="Mark picked up" className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"><Hand className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => handleDelete(pkg.id)} className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PackagesPage() { return <Suspense><PackagesContent /></Suspense>; }
