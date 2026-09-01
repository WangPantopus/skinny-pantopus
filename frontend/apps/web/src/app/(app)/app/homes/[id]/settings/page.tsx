'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Pencil, Check, X, ShieldCheck, Users, Share2, Key,
  CheckSquare, Receipt, Package, Wrench, BarChart3, LogOut, ChevronRight,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-app-border-subtle last:border-b-0">
      <span className="text-sm text-app-text-strong">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-[18px]' : ''}`} />
      </button>
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [home, setHome] = useState<any>(null);
  const [myAccess, setMyAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Notification prefs (local state — real impl would persist)
  const [notifs, setNotifs] = useState({ tasks: true, bills: true, packages: true, maintenance: true, polls: true });

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchData = useCallback(async () => {
    if (!homeId) return;
    const [homeRes, accessRes] = await Promise.allSettled([
      api.homes.getHome(homeId),
      api.homeIam.getMyHomeAccess(homeId),
    ]);
    if (homeRes.status === 'fulfilled') {
      const h = (homeRes.value as any)?.home || homeRes.value;
      setHome(h);
      setNickname(h?.nickname || h?.name || '');
    }
    if (accessRes.status === 'fulfilled') setMyAccess((accessRes.value as any)?.access || accessRes.value);
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const canEdit = myAccess?.isOwner || myAccess?.permissions?.includes('home.edit') || myAccess?.role_base === 'owner' || myAccess?.role_base === 'admin';
  const canManageSecurity = myAccess?.isOwner || myAccess?.role_base === 'owner';

  const saveNickname = useCallback(async () => {
    if (!nickname.trim() || !canEdit) return;
    setSaving(true);
    try {
      await api.homes.updateHome(homeId!, { public_info: { nickname: nickname.trim() } });
      setEditing(false);
      toast.success('Name updated');
      await fetchData();
    } catch (err: any) { toast.error(err?.message || 'Failed to update'); }
    finally { setSaving(false); }
  }, [homeId, nickname, canEdit, fetchData]);

  const handleLeave = useCallback(async () => {
    const yes = await confirmStore.open({ title: 'Leave Home', description: 'Are you sure you want to leave? You will lose access.', confirmLabel: 'Leave', variant: 'destructive' });
    if (!yes) return;
    try { await api.homes.detachFromHome(homeId!); router.push('/app/hub'); }
    catch (err: any) { toast.error(err?.message || 'Failed to leave home'); }
  }, [homeId, router]);

  const MENU_ITEMS = [
    canManageSecurity && { icon: ShieldCheck, color: 'text-emerald-600', label: 'Security & Privacy', href: `/app/homes/${homeId}/settings/security` },
    { icon: Users, color: 'text-green-600', label: 'Members & Roles', href: `/app/homes/${homeId}/members` },
    { icon: Share2, color: 'text-purple-600', label: 'Guest Passes', href: `/app/homes/${homeId}/share` },
    { icon: Key, color: 'text-amber-600', label: 'Access & Codes', href: `/app/homes/${homeId}/access` },
  ].filter(Boolean) as { icon: typeof ShieldCheck; color: string; label: string; href: string }[];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Settings</h1>
      </div>

      {/* Home Info */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-app-text mb-3">Home Info</h2>
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden divide-y divide-app-border-subtle">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wide mb-1">Nickname</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} autoFocus
                  className="flex-1 px-3 py-1.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <button onClick={saveNickname} disabled={saving} className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white disabled:opacity-50">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditing(false); setNickname(home?.nickname || home?.name || ''); }} className="w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center">
                  <X className="w-4 h-4 text-app-text-secondary" />
                </button>
              </div>
            ) : (
              <button onClick={() => canEdit && setEditing(true)} disabled={!canEdit} className="flex items-center justify-between w-full">
                <span className="text-sm text-app-text">{home?.name || 'Unnamed'}</span>
                {canEdit && <Pencil className="w-4 h-4 text-app-text-muted" />}
              </button>
            )}
          </div>
          {home?.address && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wide mb-1">Address</p>
              <p className="text-sm text-app-text">{home.address}</p>
            </div>
          )}
          {home?.home_type && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wide mb-1">Type</p>
              <p className="text-sm text-app-text capitalize">{home.home_type}</p>
            </div>
          )}
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wide mb-1">Your Role</p>
            <p className="text-sm text-app-text capitalize">{myAccess?.isOwner ? 'Owner' : (myAccess?.role_base || 'Member')}</p>
          </div>
        </div>
      </section>

      {/* Manage links */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-app-text mb-3">Manage</h2>
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden divide-y divide-app-border-subtle">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-app-hover transition text-left">
                <Icon className={`w-5 h-5 ${item.color}`} />
                <span className="flex-1 text-sm text-app-text">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-app-text-muted" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Notifications */}
      <section className="mb-6">
        <h2 className="text-sm font-bold text-app-text mb-3">Notifications</h2>
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          <Toggle label="Task reminders" checked={notifs.tasks} onChange={(v) => setNotifs((n) => ({ ...n, tasks: v }))} />
          <Toggle label="Bill due dates" checked={notifs.bills} onChange={(v) => setNotifs((n) => ({ ...n, bills: v }))} />
          <Toggle label="Package arrivals" checked={notifs.packages} onChange={(v) => setNotifs((n) => ({ ...n, packages: v }))} />
          <Toggle label="Maintenance alerts" checked={notifs.maintenance} onChange={(v) => setNotifs((n) => ({ ...n, maintenance: v }))} />
          <Toggle label="New polls" checked={notifs.polls} onChange={(v) => setNotifs((n) => ({ ...n, polls: v }))} />
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-sm font-bold text-red-600 mb-3">Danger Zone</h2>
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          <button onClick={handleLeave} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition text-left">
            <LogOut className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-600">Leave Home</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() { return <Suspense><SettingsContent /></Suspense>; }
