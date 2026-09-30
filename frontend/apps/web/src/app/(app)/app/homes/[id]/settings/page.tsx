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

function SettingsContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [home, setHome] = useState<any>(null);
  const [myAccess, setMyAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A 403 is the viewer's permission, not a failed read: no retry can change it.
  const [loadDenied, setLoadDenied] = useState(false);

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
      setLoadError(null);
      setLoadDenied(false);
    } else if ((homeRes.reason as { statusCode?: number } | null)?.statusCode === 403) {
      setLoadDenied(true); setLoadError('You don’t have permission to view this home’s settings.');
    } else {
      // Without the Home, the page would show "Unnamed" and a Leave Home for nothing it could name.
      setLoadDenied(false); setLoadError('Current home settings could not be loaded. Retry to check current information.'); toast.error('Failed to load home settings');
    }
    if (accessRes.status === 'fulfilled') setMyAccess((accessRes.value as any)?.access || accessRes.value);
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchData().finally(() => setLoading(false)); }, [fetchData]);

  const canEdit = myAccess?.isOwner || myAccess?.permissions?.includes('home.edit') || myAccess?.role_base === 'owner' || myAccess?.role_base === 'admin';
  const canManageSecurity = myAccess?.isOwner || myAccess?.role_base === 'owner';
  // Guest passes need members.manage (the server answers everyone else 403);
  // shown when the viewer's access didn't load, as before.
  const canManageGuestPasses = !myAccess || myAccess?.isOwner || myAccess?.permissions?.includes('members.manage');
  // Likewise the Members & Roles read needs members.view, and Access & Codes needs
  // access.view_wifi or access.view_codes.
  const canViewMembers = !myAccess || myAccess?.isOwner || myAccess?.permissions?.includes('members.view');
  const canViewAccess = !myAccess || myAccess?.isOwner || myAccess?.permissions?.includes('access.view_wifi') || myAccess?.permissions?.includes('access.view_codes');

  const saveNickname = useCallback(async () => {
    if (!nickname.trim() || !canEdit) return;
    setSaving(true);
    try {
      await api.homes.updateHome(homeId!, { name: nickname.trim() });
      setEditing(false);
      toast.success('Name updated');
      await fetchData();
    } catch (err: any) { toast.error(err?.message || 'Failed to update'); }
    finally { setSaving(false); }
  }, [homeId, nickname, canEdit, fetchData]);

  const handleLeave = useCallback(async () => {
    const yes = await confirmStore.open({ title: 'Leave Home', description: 'Are you sure you want to leave? You will lose access.', confirmLabel: 'Leave', variant: 'destructive' });
    if (!yes) return;
    try { await api.homes.leaveHome(homeId!); router.push('/app/hub'); }
    catch (err: any) { toast.error(err?.message || 'Failed to leave home'); }
  }, [homeId, router]);

  const MENU_ITEMS = [
    canManageSecurity && { icon: ShieldCheck, color: 'text-emerald-600', label: 'Security & Privacy', href: `/app/homes/${homeId}/settings/security` },
    canViewMembers && { icon: Users, color: 'text-green-600', label: 'Members & Roles', href: `/app/homes/${homeId}/members` },
    canManageGuestPasses && { icon: Share2, color: 'text-purple-600', label: 'Guest Passes', href: `/app/homes/${homeId}/share` },
    canViewAccess && { icon: Key, color: 'text-amber-600', label: 'Access & Codes', href: `/app/homes/${homeId}/access` },
  ].filter(Boolean) as { icon: typeof ShieldCheck; color: string; label: string; href: string }[];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  const header = (
    <div className="flex items-center gap-3 mb-6">
      <button onClick={() => router.back()} aria-label="Back" className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
      <h1 className="text-xl font-bold text-app-text">Settings</h1>
    </div>
  );

  if (loadError) return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {header}
      <div className="text-center py-16">
        <p className="text-sm text-app-text-secondary">{loadError}</p>
        {!loadDenied && (<button type="button" onClick={() => { setLoading(true); fetchData().finally(() => setLoading(false)); }} className="mt-3 px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition">Retry</button>)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {header}

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

      {/* Manage links (none for a viewer who may open none of them) */}
      {MENU_ITEMS.length > 0 && <section className="mb-6">
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
      </section>}

      {/* No Notifications section here: its switches rendered with no height,
          kept their state in this page only and saved nothing. */}

      {/* Danger zone */}
      <section>
        <h2 className="text-sm font-bold text-red-600 dark:text-red-400 mb-3">Danger Zone</h2>
        <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
          <button onClick={handleLeave} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 transition text-left">
            <LogOut className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">Leave Home</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() { return <Suspense><SettingsContent /></Suspense>; }
