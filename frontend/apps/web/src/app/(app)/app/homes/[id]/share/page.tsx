'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Wifi, BedDouble, Wrench, CalendarDays, Share2, XCircle, Users } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const TEMPLATES: { id: string; label: string; icon: typeof Wifi; duration: string; color: string }[] = [
  { id: 'wifi_only', label: 'Wi-Fi Only',       icon: Wifi,         duration: '2 hours',  color: '#0284c7' },
  { id: 'guest',     label: 'Guest',             icon: BedDouble,    duration: '48 hours', color: '#059669' },
  { id: 'vendor',    label: 'Vendor / Service',  icon: Wrench,       duration: '8 hours',  color: '#d97706' },
  { id: 'airbnb',    label: 'Airbnb / Custom',   icon: CalendarDays, duration: 'Custom',   color: '#7c3aed' },
];

function formatExpiry(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  if (diff < 0) return 'Expired';
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return `${Math.floor(diff / 60000)}m remaining`;
  if (hrs < 24) return `${hrs}h remaining`;
  return `${Math.floor(hrs / 24)}d remaining`;
}

function ShareContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchPasses = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeIam.getGuestPasses(homeId);
      setPasses((res as any)?.passes || []);
    } catch { toast.error('Failed to load guest passes'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchPasses().finally(() => setLoading(false)); }, [fetchPasses]);

  const activePasses = passes.filter((p: any) => p.status === 'active' && (!p.end_at || new Date(p.end_at) > new Date()));
  const expiredPasses = passes.filter((p: any) => p.status !== 'active' || (p.end_at ? new Date(p.end_at) <= new Date() : false));

  const handleCreatePass = useCallback(async () => {
    if (!selectedTemplate || !guestName.trim()) return;
    setCreating(true);
    try {
      const res = await api.homeIam.createGuestPass(homeId!, {
        label: `${guestName.trim()} (${selectedTemplate})`,
        kind: selectedTemplate as any,
      });
      setGuestName(''); setSelectedTemplate(null); setShowCreate(false);
      toast.success('Guest pass created');
      await fetchPasses();

      const passUrl = (res as any)?.share_url || (res as any)?.url || (res as any)?.token;
      if (passUrl) {
        try { await navigator.clipboard.writeText(passUrl); toast.success('Share link copied to clipboard'); }
        catch { /* ignore */ }
      }
    } catch (err: any) { toast.error(err?.message || 'Failed to create pass'); }
    finally { setCreating(false); }
  }, [homeId, selectedTemplate, guestName, fetchPasses]);

  const revokePass = useCallback(async (passId: string) => {
    const yes = await confirmStore.open({ title: 'Revoke Access', description: 'This guest will immediately lose access.', confirmLabel: 'Revoke', variant: 'destructive' });
    if (!yes) return;
    try { await api.homeIam.revokeGuestPass(homeId!, passId); toast.success('Access revoked'); await fetchPasses(); }
    catch { toast.error('Failed to revoke pass'); }
  }, [homeId, fetchPasses]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Share Access</h1>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> New Pass
        </button>
      </div>

      {/* Quick share templates */}
      {showCreate && (
        <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-4">
          <p className="text-sm font-bold text-app-text">Quick Share</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => {
              const TplIcon = t.icon;
              const isSelected = selectedTemplate === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setSelectedTemplate(isSelected ? null : t.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${isSelected ? 'border-current' : 'border-app-border'}`}
                  style={isSelected ? { borderColor: t.color, backgroundColor: t.color + '08' } : undefined}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: t.color + '15' }}>
                    <TplIcon className="w-5 h-5" style={{ color: t.color }} />
                  </div>
                  <span className="text-xs font-semibold text-app-text">{t.label}</span>
                  <span className="text-[10px] text-app-text-muted">{t.duration}</span>
                </button>
              );
            })}
          </div>

          {selectedTemplate && (
            <div className="space-y-3 pt-2">
              <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name"
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              <button onClick={handleCreatePass} disabled={creating || !guestName.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
                {creating ? 'Creating...' : <><Share2 className="w-4 h-4" /> Create & Share</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active passes */}
      {activePasses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-app-text-strong mb-3">Active Passes ({activePasses.length})</h2>
          <div className="space-y-2">
            {activePasses.map((pass: any) => (
              <div key={pass.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <div className="w-1 h-8 rounded-full bg-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app-text">{pass.label || 'Guest Pass'}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-app-text-secondary capitalize">{pass.kind}</span>
                    <span className="text-xs text-amber-500 font-medium">{pass.end_at ? formatExpiry(pass.end_at) : 'No expiry'}</span>
                  </div>
                </div>
                <button onClick={() => revokePass(pass.id)} title="Revoke" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past passes */}
      {expiredPasses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-app-text-strong mb-3">Past Passes ({expiredPasses.length})</h2>
          <div className="space-y-2">
            {expiredPasses.slice(0, 10).map((pass: any) => (
              <div key={pass.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 opacity-60">
                <div className="w-1 h-8 rounded-full bg-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-app-text">{pass.label || 'Guest Pass'}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-xs text-app-text-secondary capitalize">{pass.kind}</span>
                    <span className="text-xs text-app-text-muted">{pass.status === 'revoked' ? 'Revoked' : 'Expired'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {passes.length === 0 && !showCreate && (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No guest passes</p>
          <p className="text-xs text-app-text-muted mt-1">Tap + to create a quick-share guest pass</p>
        </div>
      )}
    </div>
  );
}

export default function SharePage() { return <Suspense><ShareContent /></Suspense>; }
