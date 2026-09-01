'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Eye, EyeOff, Copy, KeyRound, Wifi, Lock, Car, Shield } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const CATEGORY_META: Record<string, { icon: typeof Wifi; color: string; label: string }> = {
  wifi:    { icon: Wifi,     color: '#0284c7', label: 'Wi-Fi' },
  alarm:   { icon: Shield,   color: '#dc2626', label: 'Alarm' },
  gate:    { icon: KeyRound, color: '#f59e0b', label: 'Gate / Door' },
  lockbox: { icon: Lock,     color: '#7c3aed', label: 'Lockbox' },
  garage:  { icon: Car,      color: '#16a34a', label: 'Garage' },
  other:   { icon: KeyRound, color: '#6b7280', label: 'Other' },
};

function AccessContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [secrets, setSecrets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);
  useEffect(() => () => { Object.values(timersRef.current).forEach(clearTimeout); }, []);

  const fetchSecrets = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeProfile.getHomeAccessSecrets(homeId);
      setSecrets((res as any)?.secrets || []);
    } catch { toast.error('Failed to load access codes'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchSecrets().finally(() => setLoading(false)); }, [fetchSecrets]);

  const toggleReveal = (secretId: string) => {
    if (revealed[secretId]) {
      setRevealed((r) => ({ ...r, [secretId]: false }));
      if (timersRef.current[secretId]) { clearTimeout(timersRef.current[secretId]); delete timersRef.current[secretId]; }
    } else {
      setRevealed((r) => ({ ...r, [secretId]: true }));
      timersRef.current[secretId] = setTimeout(() => setRevealed((r) => ({ ...r, [secretId]: false })), 30000);
    }
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    } catch { toast.error('Failed to copy'); }
  };

  const grouped = secrets.reduce<Record<string, any[]>>((acc, s) => {
    const cat = s.category || 'other';
    (acc[cat] = acc[cat] || []).push(s);
    return acc;
  }, {});

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Access & Codes</h1>
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 mb-4">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <p className="text-xs text-emerald-700 font-medium">Values auto-hide after 30 seconds</p>
      </div>

      {secrets.length === 0 ? (
        <div className="text-center py-16">
          <Lock className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No access codes stored</p>
          <p className="text-xs text-app-text-muted mt-1">Add Wi-Fi, alarm codes, and more from settings</p>
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
                        <p className="text-sm font-medium text-app-text">{secret.label || secret.title}</p>
                        {secret.description && <p className="text-xs text-app-text-secondary mt-0.5">{secret.description}</p>}
                        <p className="text-base font-semibold font-mono tracking-wider text-app-text mt-2">
                          {revealed[secret.id] ? (secret.value || secret.code) : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleReveal(secret.id)} className="w-9 h-9 rounded-lg bg-app-surface-sunken flex items-center justify-center hover:bg-app-hover transition" title={revealed[secret.id] ? 'Hide' : 'Reveal'}>
                          {revealed[secret.id] ? <EyeOff className="w-4 h-4 text-app-text-secondary" /> : <Eye className="w-4 h-4 text-app-text-secondary" />}
                        </button>
                        {revealed[secret.id] && (
                          <button onClick={() => copyValue(secret.value || secret.code)} className="w-9 h-9 rounded-lg bg-app-surface-sunken flex items-center justify-center hover:bg-app-hover transition" title="Copy">
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
