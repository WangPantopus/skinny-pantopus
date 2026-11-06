'use client';

/**
 * Privacy preview — unified-IA §8.2.
 *
 * Lets the user pick a surface (their personal profile or their public
 * profile) and a viewer mode (one of the 7 + tier ranks). The page calls
 * GET /api/identity-center/view-as which runs the actual production
 * serializers — no frontend approximation. The "Visible to this viewer"
 * panel shows the literal serializer output; the "Hidden from this
 * viewer" panel lists the forbidden personal-side fields the serializer
 * dropped, computed server-side against ALL_IDENTITY_FIELDS.
 *
 * The deviation between this preview and reality is, by construction,
 * zero: the same code path serves both. Per §8.2: "users can SEE that
 * the firewall holds."
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, EyeOff } from 'lucide-react';
import * as api from '@pantopus/api';
import type { ViewAsPreview } from '@pantopus/types';

type Surface = 'local' | 'persona';
type ViewerMode =
  | 'public'
  | 'verified_local'
  | 'neighbor'
  | 'household_member'
  | 'business_teammate'
  | 'persona_follower'
  | 'persona_member'
  | 'persona_insider';

const SURFACES: ReadonlyArray<{ id: Surface; label: string }> = [
  { id: 'local',   label: 'My personal profile' },
  { id: 'persona', label: 'My Beacon' },
];

const VIEWER_MODES: ReadonlyArray<{ id: ViewerMode; label: string; surface: Surface | 'both' }> = [
  { id: 'public',            label: 'Public stranger',                     surface: 'both' },
  { id: 'verified_local',    label: 'Verified neighbor (same area)',       surface: 'local' },
  { id: 'neighbor',          label: 'Connection of mine',                  surface: 'local' },
  { id: 'household_member',  label: 'Someone in my household',             surface: 'local' },
  { id: 'business_teammate', label: 'My business teammate',                surface: 'local' },
  { id: 'persona_follower',  label: 'My Beacon follower',                  surface: 'persona' },
  { id: 'persona_member',    label: 'My Beacon Member',                    surface: 'persona' },
  { id: 'persona_insider',   label: 'My Beacon Insider',                   surface: 'persona' },
];

function defaultViewerForSurface(surface: Surface): ViewerMode {
  return 'public';
}

export default function PrivacyPreviewPage() {
  const [surface, setSurface] = useState<Surface>('local');
  const [viewer, setViewer] = useState<ViewerMode>('public');
  const [data, setData] = useState<ViewAsPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleViewerOptions = useMemo(
    () => VIEWER_MODES.filter((v) => v.surface === 'both' || v.surface === surface),
    [surface],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.identityCenter.getViewAsPreview({ surface, viewer })
      .then((res) => { if (!cancelled) { setData(res); } })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to build preview.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [surface, viewer]);

  const visible = data?.visible ?? data?.profile ?? null;
  const hidden = data?.hidden ?? [];

  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/app/identity"
          className="mb-4 inline-flex items-center gap-1 text-sm text-app-secondary hover:text-app"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Profiles &amp; Privacy
        </Link>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-app">Privacy preview</h1>
          <p className="mt-1 text-sm text-app-secondary">
            See exactly what someone else sees when they view your profile. The output below is
            produced by the same code paths Pantopus uses in production — there is no approximation.
          </p>
        </header>

        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-app-secondary">
              Profile
            </span>
            <select
              data-testid="privacy-preview-surface"
              value={surface}
              onChange={(e) => {
                const next = e.target.value as Surface;
                setSurface(next);
                // Reset viewer to a value valid for the new surface.
                setViewer(defaultViewerForSurface(next));
              }}
              className="w-full rounded-lg border border-app-strong bg-surface px-3 py-2 text-sm text-app outline-none focus:ring-2 focus:ring-primary-500"
            >
              {SURFACES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-app-secondary">
              Viewer
            </span>
            <select
              data-testid="privacy-preview-viewer"
              value={viewer}
              onChange={(e) => setViewer(e.target.value as ViewerMode)}
              className="w-full rounded-lg border border-app-strong bg-surface px-3 py-2 text-sm text-app outline-none focus:ring-2 focus:ring-primary-500"
            >
              {visibleViewerOptions.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-app-secondary" aria-busy="true">Loading preview…</p>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : data ? (
          <div className="grid gap-4 md:grid-cols-2">
            <section
              data-testid="privacy-preview-visible"
              className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10"
            >
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Visible to this viewer
              </h2>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-emerald-900 dark:text-emerald-100">
                {JSON.stringify(visible, null, 2)}
              </pre>
            </section>

            <section
              data-testid="privacy-preview-hidden"
              className="rounded-lg border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-900/10"
            >
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-300">
                <EyeOff className="h-4 w-4" aria-hidden />
                Hidden from this viewer
              </h2>
              {hidden.length === 0 ? (
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  All forbidden personal-side fields are hidden by the serializer for this viewer.
                </p>
              ) : (
                <ul className="space-y-1 text-sm text-rose-900 dark:text-rose-100">
                  {hidden.map((field) => (
                    <li key={field} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />
                      <code className="font-mono text-xs">{field}</code>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
