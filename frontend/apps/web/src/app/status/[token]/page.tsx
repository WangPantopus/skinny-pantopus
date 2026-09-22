'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Link2, Navigation, RefreshCw } from 'lucide-react';
import * as api from '@pantopus/api';
import { GIG_STATUS_STYLES, statusClasses, statusLabel } from '@pantopus/ui-utils';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

type SharedStatus = Awaited<ReturnType<typeof api.gigs.getSharedGigStatus>>;
type View = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'error' } | { kind: 'ready'; data: SharedStatus };

export default function SharedTaskStatusPage() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen bg-app-surface-raised">
      <main className="max-w-lg mx-auto px-4 py-8">
        <Link href="/" className="text-lg font-semibold text-app-text">Pantopus</Link>
        {typeof token === 'string' && /^[a-f0-9]{32}$/.test(token)
          ? <StatusEntry key={token} token={token} /> : <Unavailable />}
      </main>
    </div>
  );
}

function Unavailable() {
  return <EmptyState icon={Link2} title="Status link unavailable" description="This link has expired or is no longer available. Ask the task owner or helper for a new link." />;
}

function StatusEntry({ token }: { token: string }) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let current = true, loading = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const unavailable = () => {
      current = false;
      controller.abort();
      clearInterval(poll);
      clearTimeout(expiryTimer);
      setView({ kind: 'unavailable' });
    };
    const load = async () => {
      if (!current || loading) return;
      loading = true;
      try {
        const data = await api.gigs.getSharedGigStatus(token, { signal: controller.signal, suppressDevErrorOverlay: true });
        if (!current) return;
        const expiresAt = Date.parse(data?.expires_at);
        if (!Number.isFinite(expiresAt) || typeof data?.title !== 'string' || !data.title.trim()
          || typeof data.status !== 'string' || (data.helper_first_name !== null && typeof data.helper_first_name !== 'string')
          || (data.helper_eta_minutes !== null && (!Number.isFinite(data.helper_eta_minutes) || data.helper_eta_minutes < 0))) {
          throw new Error('Invalid shared status');
        }
        if (expiresAt <= Date.now()) { unavailable(); return; }
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(unavailable, Math.min(expiresAt - Date.now(), 2147483647));
        setView({ kind: 'ready', data });
      } catch (error) {
        if (!current) return;
        if ((error as { statusCode?: number }).statusCode === 404) unavailable();
        else setView({ kind: 'error' });
      } finally { loading = false; }
    };
    const poll = setInterval(() => { void load(); }, 30000);
    void load();
    return () => { current = false; controller.abort(); clearInterval(poll); clearTimeout(expiryTimer); };
  }, [token, attempt]);

  const refresh = () => { setView({ kind: 'loading' }); setAttempt(value => value + 1); };
  if (view.kind === 'loading') return <p role="status" className="text-sm text-app-text-secondary text-center py-16">Loading task status...</p>;
  if (view.kind === 'unavailable') return <Unavailable />;
  if (view.kind === 'error') return <ErrorState message="Task status is temporarily unavailable. Please try again." onRetry={refresh} />;
  const { data } = view;
  const active = data.status === 'assigned' || data.status === 'in_progress';
  const locationAge = Date.now() - Date.parse(data.helper_location_updated_at ?? '');
  const freshETA = data.helper_eta_minutes !== null && Number.isFinite(locationAge) && locationAge >= 0 && locationAge <= 5 * 60000;
  return (
    <section className="mt-6 bg-app-surface border border-app-border rounded-xl p-6 space-y-5">
      <p className="text-sm text-app-text-secondary">Task status</p>
      <h1 className="text-xl font-semibold text-app-text break-words">{data.title}</h1>
      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusClasses(GIG_STATUS_STYLES, data.status)}`}>
        {statusLabel(GIG_STATUS_STYLES, data.status)}
      </span>
      {data.helper_first_name && <p className="text-sm text-app-text-secondary">Helper: {data.helper_first_name}</p>}
      {active && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <Navigation className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-app-text">{freshETA ? `Helper ETA: ~${data.helper_eta_minutes} min` : 'Waiting for a current location update'}</p>
        </div>
      )}
      <button onClick={refresh} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-emerald-600 border border-emerald-300 bg-white rounded-full hover:bg-emerald-50 transition">
        <RefreshCw className="w-4 h-4" />Refresh status
      </button>
    </section>
  );
}
