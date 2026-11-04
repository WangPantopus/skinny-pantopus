'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Eye, EyeOff, Copy, KeyRound, Wifi, Lock, Car, Shield } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { onSyncTopic, touchesHome } from '@/lib/syncSignals';

const CATEGORY_META: Record<string, { icon: typeof Wifi; color: string; label: string }> = {
  wifi:    { icon: Wifi,     color: '#0284c7', label: 'Wi-Fi' },
  alarm:   { icon: Shield,   color: '#dc2626', label: 'Alarm' },
  gate:    { icon: KeyRound, color: '#f59e0b', label: 'Gate / Door' },
  lockbox: { icon: Lock,     color: '#7c3aed', label: 'Lockbox' },
  garage:  { icon: Car,      color: '#16a34a', label: 'Garage' },
  other:   { icon: KeyRound, color: '#6b7280', label: 'Other' },
};

// The API sends each code's access_type; door and gate codes share one group.
const CATEGORY_OF_TYPE: Record<string, string> = {
  wifi: 'wifi', alarm: 'alarm', door_code: 'gate', gate_code: 'gate', lockbox: 'lockbox', garage: 'garage',
};

function AccessContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [secrets, setSecrets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // A failed read is shown as unavailable with a retry, never as an empty list.
  const [loadError, setLoadError] = useState<string | null>(null);
  // A 403 refuses this read; a later return or access change checks again.
  const [loadDenied, setLoadDenied] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const generation = useRef(0);
  const activeRead = useRef<AbortController | null>(null);
  const away = useRef(false);
  const ready = useRef(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const clearTimers = useCallback(() => {
    Object.values(timersRef.current).forEach(clearTimeout); timersRef.current = {};
  }, []);
  const cancelRead = useCallback(() => {
    generation.current++; ready.current = false;
    activeRead.current?.abort(); activeRead.current = null;
  }, []);
  const retire = useCallback(() => {
    cancelRead(); clearTimers();
    setSecrets([]); setRevealed({}); setLoadError(null); setLoading(true);
  }, [cancelRead, clearTimers]);

  const fetchSecrets = useCallback(async () => {
    if (!homeId || away.current || document.visibilityState === 'hidden' || activeRead.current) return;
    retire();
    const request = generation.current;
    const controller = new AbortController(); activeRead.current = controller;
    setLoadDenied(false);
    try {
      const res = await api.homeProfile.getHomeAccessSecrets(homeId, controller.signal);
      if (request !== generation.current) return;
      if (!Array.isArray(res?.secrets) || res.secrets.some((row) =>
        !row || typeof row !== 'object' || Array.isArray(row))) {
        throw new Error('Invalid secrets response');
      }
      setLoadError(null);
      setLoadDenied(false);
      setSecrets(res.secrets);
      ready.current = true;
    } catch (err: unknown) {
      if (request !== generation.current) return;
      if ((err as { statusCode?: number } | null)?.statusCode === 403) { setLoadDenied(true); setLoadError('You don’t have permission to view this household’s access codes.'); return; }
      setLoadDenied(false);
      setLoadError('Current access codes could not be loaded. Retry to check current information.'); toast.error('Failed to load access codes');
    } finally {
      if (request === generation.current) { activeRead.current = null; setLoading(false); }
    }
  }, [homeId, retire]);

  useEffect(() => {
    // A return must authorize the codes again; never retain a revealed value
    // through a background, session change, failed read or superseded reply.
    const depart = () => { away.current = true; retire(); };
    const resume = () => { if (document.visibilityState !== 'hidden') { away.current = false; void fetchSecrets(); } };
    const visibility = () => { if (document.visibilityState === 'hidden') depart(); else resume(); };
    const changed = () => { retire(); void fetchSecrets(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    const unsubscribeSync = onSyncTopic((topic) => {
      if (topic === 'homes' || touchesHome(topic, homeId)) changed();
    });
    window.addEventListener('focus', resume); window.addEventListener('blur', depart);
    window.addEventListener('pageshow', resume); window.addEventListener('pagehide', depart);
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', visibility);
    retire(); resume();
    return () => {
      away.current = true; cancelRead(); clearTimers(); unsubscribe(); unsubscribeSync();
      window.removeEventListener('focus', resume); window.removeEventListener('blur', depart);
      window.removeEventListener('pageshow', resume); window.removeEventListener('pagehide', depart);
      window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visibility);
    };
  }, [homeId, fetchSecrets, retire, cancelRead, clearTimers]);

  const toggleReveal = (secretId: string) => {
    if (!ready.current || away.current || document.visibilityState === 'hidden') return;
    if (revealed[secretId]) {
      setRevealed((r) => ({ ...r, [secretId]: false }));
      if (timersRef.current[secretId]) { clearTimeout(timersRef.current[secretId]); delete timersRef.current[secretId]; }
    } else {
      setRevealed((r) => ({ ...r, [secretId]: true }));
      timersRef.current[secretId] = setTimeout(() => {
        delete timersRef.current[secretId]; setRevealed((r) => ({ ...r, [secretId]: false }));
      }, 30000);
    }
  };

  const copyValue = async (value: string) => {
    if (!ready.current || away.current || document.visibilityState === 'hidden') return;
    const request = generation.current;
    try {
      await navigator.clipboard.writeText(value);
      if (request === generation.current) toast.success('Copied to clipboard');
    } catch { if (request === generation.current) toast.error('Failed to copy'); }
  };

  const grouped = secrets.reduce<Record<string, any[]>>((acc, s) => {
    const cat = CATEGORY_OF_TYPE[s.access_type] || 'other';
    (acc[cat] = acc[cat] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} aria-label="Back" className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Access & Codes</h1>
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-4">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs text-emerald-700 font-medium">Values auto-hide after 30 seconds</p>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading access codes" className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      ) : loadError ? (
        <div className="text-center py-16">
          <p className="text-sm text-app-text-secondary">{loadError}</p>
          {!loadDenied && (<button type="button" onClick={() => void fetchSecrets()} className="mt-3 px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition">Retry</button>)}
        </div>
      ) : secrets.length === 0 ? (
        <div className="text-center py-16">
          <Lock className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No access codes stored</p>
          <p className="text-xs text-app-text-muted mt-1">Wi-Fi, alarm codes and more added in the Pantopus app on your phone show up here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, catSecrets]) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.other;
            const CatIcon = meta.icon;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <CatIcon className="w-4 h-4" style={{ color: meta.color }} />
                  <h2 className="text-sm font-bold text-app-text-strong flex-1">{meta.label}</h2>
                  <span className="text-xs text-app-text-muted bg-app-surface-sunken px-2 py-0.5 rounded-full">{catSecrets.length}</span>
                </div>
                <div className="space-y-2">
                  {catSecrets.map((secret: any) => (
                    <div key={secret.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text break-words">{secret.label || secret.title}</p>
                        {(secret.notes || secret.description) && <p className="text-xs text-app-text-secondary mt-0.5 break-words whitespace-pre-line">{secret.notes || secret.description}</p>}
                        <p className="text-base font-semibold font-mono tracking-wider text-app-text mt-2 break-all">
                          {revealed[secret.id] ? (secret.secret_value ?? secret.value ?? secret.code) : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleReveal(secret.id)} className="w-9 h-9 rounded-lg bg-app-surface-sunken flex items-center justify-center hover:bg-app-hover transition" title={revealed[secret.id] ? 'Hide' : 'Reveal'}>
                          {revealed[secret.id] ? <EyeOff className="w-4 h-4 text-app-text-secondary" /> : <Eye className="w-4 h-4 text-app-text-secondary" />}
                        </button>
                        {revealed[secret.id] && (
                          <button onClick={() => copyValue(secret.secret_value ?? secret.value ?? secret.code)} className="w-9 h-9 rounded-lg bg-app-surface-sunken flex items-center justify-center hover:bg-app-hover transition" title="Copy">
                            <Copy className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AccessPage() { return <Suspense><AccessContent /></Suspense>; }
