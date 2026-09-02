'use client';

// ============================================================
// The privacy mirror (Wedge v2 §2): your home exactly as a neighbor
// outside your household sees it. Not a mock-up — the backend renders
// it through the same serializer that answers a real outsider, so what
// this page shows is what they get. The difference between "creepy" and
// "careful" is being able to check.
// ============================================================

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, EyeOff, ShieldCheck, MapPin } from 'lucide-react';
import * as api from '@pantopus/api';
import PrivacyPromise from '@/components/place/PrivacyPromise';
import { ShimmerBlock } from '@/components/ui/Shimmer';

function initialOf(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return n ? n[0].toUpperCase() : '·';
}

export default function HomePrivacyMirrorPage() {
  const params = useParams<{ id: string }>();
  const homeId = params?.id ?? '';
  const mirrorQuery = useQuery({
    queryKey: ['home', homeId, 'privacy-mirror'],
    queryFn: () => api.identityCenter.getHomeMirror(homeId),
    enabled: !!homeId,
    staleTime: 60_000,
    retry: false,
  });
  const mirror = mirrorQuery.data;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/app/place" className="inline-flex items-center gap-1 text-[13px] font-semibold text-app-text-secondary hover:text-app-text">
        <ChevronLeft size={16} strokeWidth={2.25} /> Your Place
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-app-text leading-tight">What neighbors see</h1>
      <p className="mt-2 text-sm text-app-text-secondary leading-relaxed">
        This is your address as someone outside your household sees it, rendered by the same code that serves
        them. If it looks wrong here, it is wrong for them too.
      </p>

      {mirrorQuery.isLoading ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          <ShimmerBlock className="h-24 w-full rounded-2xl" />
          <ShimmerBlock className="h-40 w-full rounded-2xl" />
        </div>
      ) : null}

      {mirrorQuery.isError ? (
        <div role="alert" className="mt-6 rounded-2xl border border-app-border bg-app-surface p-4 text-sm text-app-text">
          We couldn&apos;t load the preview. Only a member of this home can see it.
          <button type="button" onClick={() => mirrorQuery.refetch()} className="ml-2 font-semibold text-primary-600">Try again</button>
        </div>
      ) : null}

      {mirror ? (
        <>
          <section aria-label="As a neighbor sees it" className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary mb-2">{mirror.viewer_label}</p>
            <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 flex items-center gap-3">
              <span aria-hidden="true" className="inline-flex items-center justify-center shrink-0 w-11 h-11 rounded-full bg-app-home-bg text-app-home text-[17px] font-bold">
                {initialOf(mirror.owner?.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-app-text leading-[22px]">{mirror.owner?.name ?? 'A resident'}</p>
                <p className="flex items-center gap-1 text-[13.5px] text-app-text-secondary leading-[19px]">
                  <MapPin size={13} strokeWidth={2.25} className="shrink-0" />
                  <span data-testid="mirror-address">
                    {[mirror.home.address, [mirror.home.city, mirror.home.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                  </span>
                </p>
              </div>
            </div>
            <p className="mt-2 text-[12.5px] text-app-text-muted">
              {mirror.discoverable
                ? 'Street only, no house number. That is the whole card.'
                : 'Your home is not discoverable right now, so neighbors see nothing unless you share it. This is what they would see if you did.'}
            </p>
          </section>

          <section aria-label="Hidden from neighbors" className="mt-6 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <EyeOff size={15} strokeWidth={2.25} className="text-app-text-secondary shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">Never shown to neighbors</span>
            </div>
            <ul className="divide-y divide-app-border-subtle">
              {mirror.hidden.map((h) => (
                <li key={h.key} className="py-2 text-[14px] text-app-text">{h.label}</li>
              ))}
            </ul>
          </section>

          <PrivacyPromise className="mt-6" />

          <p className="mt-5 text-[13px] text-app-text-secondary">
            <ShieldCheck size={14} strokeWidth={2.25} className="inline-block mr-1 -mt-0.5 text-app-home" />
            Your profile and its visibility to followers live in{' '}
            <Link href="/app/identity" className="font-semibold text-primary-600">Profiles &amp; privacy</Link>.
          </p>
        </>
      ) : null}
    </div>
  );
}
