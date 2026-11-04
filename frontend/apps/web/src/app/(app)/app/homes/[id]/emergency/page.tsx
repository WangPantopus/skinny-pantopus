'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Phone, Droplets, DoorOpen, HeartPulse, AlertCircle, Trash2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { HomeEmergency, HomeEmergencyType } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { failureMessage, shareFailure } from '@/components/home/share/shareFailure';
import { onSyncTopic, touchesHome } from '@/lib/syncSignals';
import {
  CATEGORY_CREATE_TYPE, emergencyCategory, emergencyDetail, type EmergencyCategory,
} from '@/components/home/emergencyTypes';

const CATEGORY_META: Record<EmergencyCategory, { icon: typeof Droplets; color: string; label: string }> = {
  shutoff:    { icon: Droplets,    color: '#0284c7', label: 'Shutoffs' },
  contact:    { icon: Phone,       color: '#059669', label: 'Emergency Contacts' },
  evacuation: { icon: DoorOpen,    color: '#dc2626', label: 'Evacuation' },
  medical:    { icon: HeartPulse,  color: '#f59e0b', label: 'Medical' },
  other:      { icon: AlertCircle, color: '#6b7280', label: 'Other' },
};
const ORDERED_CATS: EmergencyCategory[] = ['shutoff', 'contact', 'evacuation', 'medical', 'other'];

function EmergencyContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [items, setItems] = useState<HomeEmergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<EmergencyCategory>('contact');
  const [newShutoffType, setNewShutoffType] = useState<HomeEmergencyType | ''>('');
  const [newDetails, setNewDetails] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  // One id per unchanged draft: a retry after a lost reply returns the saved entry instead of adding it again.
  const pendingCreate = useRef<{ draft: string; id: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A 403 is an access refusal; check again when returning or access changes.
  const [loadDenied, setLoadDenied] = useState(false);
  // A superseded list read must never replace a newer one.
  const generation = useRef(0);
  const away = useRef(false);
  const listRequest = useRef<AbortController | null>(null);
  const saveAttempt = useRef<object | null>(null);
  const pageScope = useRef<object | null>(null);
  const deletePrompt = useRef<ReturnType<typeof confirmStore.getSnapshot>>(null);

  const clearDraft = useCallback(() => {
    pendingCreate.current = null;
    setNewTitle(''); setNewShutoffType(''); setNewDetails(''); setNewPhone(''); setShowCreate(false);
  }, []);

  const cancelRead = useCallback(() => {
    generation.current++;
    listRequest.current?.abort(); listRequest.current = null;
  }, []);

  const invalidate = useCallback(() => {
    cancelRead();
    setItems([]); setCanManage(false); setLoading(true); setLoadError(null);
    if (deletePrompt.current && confirmStore.getSnapshot() === deletePrompt.current) confirmStore.close(false);
    deletePrompt.current = null;
  }, [cancelRead]);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchItems = useCallback(async () => {
    if (!homeId || away.current || document.visibilityState === 'hidden' || listRequest.current) return;
    const request = ++generation.current;
    const controller = new AbortController();
    listRequest.current = controller;
    setItems([]); setCanManage(false); setLoading(true); setLoadError(null); setLoadDenied(false);
    try {
      const res = await api.homeProfile.getHomeEmergencies(homeId, controller.signal);
      if (request !== generation.current) return;
      if (!Array.isArray(res?.emergencies)
        || res.emergencies.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
        throw new Error('Invalid emergency information response');
      }
      setLoadError(null);
      setLoadDenied(false);
      setItems(res.emergencies as HomeEmergency[]);
      setCanManage(res.canManage === true);
    } catch (err: unknown) {
      if (request !== generation.current) return;
      if ((err as { statusCode?: number } | null)?.statusCode === 403) { setLoadDenied(true); setLoadError('You don’t have permission to view this household’s emergency info.'); return; }
      setLoadDenied(false);
      setLoadError('Current emergency info could not be loaded. Retry to check current information.');
      toast.error(failureMessage(err, 'Failed to load emergency info'));
    } finally {
      if (request === generation.current) { listRequest.current = null; setLoading(false); }
    }
  }, [homeId]);

  useEffect(() => {
    pageScope.current = {};
    clearDraft(); saveAttempt.current = null; setCreating(false);
    // Emergency rows are sensitive: discard them on departure and show only a
    // fresh authorized read on return, including when that read fails.
    const depart = () => { away.current = true; invalidate(); };
    const resume = () => { if (document.visibilityState !== 'hidden') { away.current = false; void fetchItems(); } };
    const visibility = () => { if (document.visibilityState === 'hidden') depart(); else resume(); };
    const changed = () => { clearDraft(); saveAttempt.current = null; setCreating(false); invalidate(); void fetchItems(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    const unsubscribeSync = onSyncTopic((topic) => {
      if (topic === 'homes' || touchesHome(topic, homeId)) { invalidate(); void fetchItems(); }
    });
    window.addEventListener('focus', resume); window.addEventListener('blur', depart);
    window.addEventListener('pageshow', resume); window.addEventListener('pagehide', depart);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    invalidate(); resume();
    return () => {
      away.current = true; cancelRead();
      saveAttempt.current = null; pageScope.current = null;
      if (deletePrompt.current && confirmStore.getSnapshot() === deletePrompt.current) confirmStore.close(false);
      unsubscribe(); unsubscribeSync();
      window.removeEventListener('focus', resume); window.removeEventListener('blur', depart);
      window.removeEventListener('pageshow', resume); window.removeEventListener('pagehide', depart);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [homeId, fetchItems, invalidate, clearDraft, cancelRead]);

  // Saves through POST /api/homes/:id/emergencies with a HomeEmergencyType and
  // the free-form details object the native forms also write; the row shown is
  // the one the server returned, never a local placeholder.
  const handleCreate = useCallback(async () => {
    if (!canManage || !newTitle.trim() || !homeId || saveAttempt.current || (newCategory === 'shutoff' && !newShutoffType)) return;
    const attempt = {}; saveAttempt.current = attempt;
    const request = generation.current, session = api.authSessionMarker();
    setCreating(true);
    const details: Record<string, string> = {};
    if (newPhone.trim()) details.phone = newPhone.trim();
    if (newDetails.trim()) details.notes = newDetails.trim();
    try {
      const payload = { type: newCategory === 'shutoff' ? newShutoffType as HomeEmergencyType : CATEGORY_CREATE_TYPE[newCategory], label: newTitle.trim(), details };
      const draft = JSON.stringify(payload);
      if (pendingCreate.current?.draft !== draft) pendingCreate.current = { draft, id: crypto.randomUUID() };
      const res = await api.homeProfile.createHomeEmergency(homeId, { ...payload, clientRequestId: pendingCreate.current.id });
      if (saveAttempt.current !== attempt || session !== api.authSessionMarker()) return;
      const created = res?.emergency as HomeEmergency | undefined;
      if (!created?.id) throw new Error('Malformed create response');
      clearDraft();
      if (request === generation.current) {
        setItems((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
        toast.success('Emergency info added');
      } else { invalidate(); void fetchItems(); }
    } catch (err: unknown) {
      if (saveAttempt.current !== attempt || session !== api.authSessionMarker() || request !== generation.current) return;
      toast.error(failureMessage(err, 'Failed to add emergency info'));
      if ((err as { statusCode?: number } | null)?.statusCode === 403) { invalidate(); void fetchItems(); }
    } finally { if (saveAttempt.current === attempt) { saveAttempt.current = null; setCreating(false); } }
  }, [homeId, canManage, newTitle, newCategory, newShutoffType, newDetails, newPhone, clearDraft, invalidate, fetchItems]);

  const handleDelete = useCallback(async (itemId: string) => {
    if (!canManage || !homeId) return;
    const request = generation.current, session = api.authSessionMarker();
    const scope = pageScope.current;
    const confirmation = confirmStore.open({ title: 'Delete', description: 'Remove this emergency info?', confirmLabel: 'Delete', variant: 'destructive' });
    deletePrompt.current = confirmStore.getSnapshot();
    const yes = await confirmation;
    deletePrompt.current = null;
    if (!yes || scope !== pageScope.current || request !== generation.current || session !== api.authSessionMarker()) return;
    try {
      await api.homeProfile.deleteHomeEmergency(homeId, itemId);
    } catch (err: unknown) {
      if (scope !== pageScope.current || request !== generation.current || session !== api.authSessionMarker()) return;
      // Already gone on the server is the outcome the member asked for.
      if (shareFailure(err).code !== 'EMERGENCY_NOT_FOUND') {
        toast.error(failureMessage(err, 'Failed to remove emergency info'));
        if ((err as { statusCode?: number } | null)?.statusCode === 403) { invalidate(); void fetchItems(); }
        return;
      }
    }
    if (scope !== pageScope.current || session !== api.authSessionMarker()) return;
    if (request !== generation.current) { invalidate(); void fetchItems(); return; }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    toast.success('Removed');
  }, [homeId, canManage, invalidate, fetchItems]);

  // HomeEmergency rows carry `type`, never a category; group by the same rollup
  // the dashboard card and the native palettes apply.
  const grouped = items.reduce<Partial<Record<EmergencyCategory, HomeEmergency[]>>>((acc, i) => {
    const cat = emergencyCategory(i.type);
    (acc[cat] = acc[cat] || []).push(i);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} aria-label="Back" className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <h1 className="text-xl font-bold text-app-text">Emergency Info</h1>
        </div>
        {canManage && (
          <button onClick={() => setShowCreate(!showCreate)} disabled={creating} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition">
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      {/* 911 banner */}
      <a href="tel:911" className="flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl font-bold mb-4 hover:bg-red-700 transition">
        <Phone className="w-5 h-5" /> Emergency? Call 911
      </a>

      {showCreate && canManage && (
        <fieldset disabled={creating} className="min-w-0 bg-app-surface border border-app-border rounded-xl p-4 mb-4 space-y-3">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <div className="flex flex-wrap gap-1.5">
            {ORDERED_CATS.map((key) => {
              const meta = CATEGORY_META[key];
              const CatIcon = meta.icon;
              return (
                <button key={key} type="button" onClick={() => setNewCategory(key)} aria-pressed={newCategory === key}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${newCategory === key ? 'border-current' : 'border-app-border text-app-text-secondary'}`}
                  style={newCategory === key ? { color: meta.color, backgroundColor: meta.color + '12', borderColor: meta.color } : undefined}>
                  <CatIcon className="w-3 h-3" />{meta.label}
                </button>
              );
            })}
          </div>
          {newCategory === 'shutoff' && (
            <label className="block text-sm text-app-text">
              Utility or map
              <select value={newShutoffType} onChange={(e) => setNewShutoffType(e.target.value as HomeEmergencyType | '')}
                className="mt-1 w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface">
                <option value="">Choose a utility or breaker map</option>
                <option value="shutoff_water">Water shutoff</option>
                <option value="shutoff_gas">Gas shutoff</option>
                <option value="shutoff_electric">Electrical shutoff</option>
                <option value="breaker_map">Breaker map</option>
              </select>
            </label>
          )}
          <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number (optional)" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          <textarea value={newDetails} onChange={(e) => setNewDetails(e.target.value)} placeholder="Details (optional)" rows={2} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          <button onClick={handleCreate} disabled={creating || !newTitle.trim() || (newCategory === 'shutoff' && !newShutoffType)} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 transition">
            {creating ? 'Adding...' : 'Add Emergency Info'}
          </button>
        </fieldset>
      )}

      {loadError ? (
        <div className="text-center py-16">
          <p className="text-sm text-app-text-secondary">{loadError}</p>
          {!loadDenied && (<button type="button" onClick={() => void fetchItems()} className="mt-3 px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition">Retry</button>)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <HeartPulse className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No emergency info</p>
          <p className="text-xs text-app-text-muted mt-1">{canManage ? 'Add shutoff locations, emergency contacts, and evacuation routes' : 'A household manager can add emergency information.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ORDERED_CATS.filter((cat) => grouped[cat]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const CatIcon = meta.icon;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.color + '15' }}>
                    <CatIcon className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                  <h2 className="text-sm font-bold text-app-text-strong">{meta.label}</h2>
                </div>
                <div className="space-y-1.5">
                  {(grouped[cat] || []).map((item) => {
                    // `details` is a jsonb object; render its strings, never the object.
                    const notes = emergencyDetail(item, 'notes') || emergencyDetail(item, 'detail');
                    const phone = emergencyDetail(item, 'phone');
                    return (
                    <div key={item.id} className="flex items-start gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text">{item.label}</p>
                        {item.location && <p className="text-xs text-app-text-secondary mt-1">{item.location}</p>}
                        {notes && <p className="text-xs text-app-text-secondary mt-1">{notes}</p>}
                        {phone && (
                          <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium hover:underline">
                            <Phone className="w-3.5 h-3.5" />{phone}
                          </a>
                        )}
                      </div>
                      {canManage && <button onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.label}`} className="p-1 text-app-text-muted hover:text-red-500 transition flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>}
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

export default function EmergencyPage() { return <Suspense><EmergencyContent /></Suspense>; }
