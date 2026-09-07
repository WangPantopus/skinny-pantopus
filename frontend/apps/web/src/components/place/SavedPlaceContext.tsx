'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import PendingPlaceSaver from './PendingPlaceSaver';
import { PreviewBody } from './StartFunnel';
import ErrorState from '@/components/ui/ErrorState';
import { extractApiError } from '@/lib/auth-utils';

/** SavedPlace is a private bookmark, never a Home or an access credential. */
export default function SavedPlaceContext({ previewId, savedPlaceId }: { previewId?: string; savedPlaceId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const viewer = useQuery({ queryKey: ['place-entry', 'viewer'], queryFn: () => api.users.getMyProfile(), staleTime: 0, retry: false, refetchOnWindowFocus: true });
  const userId = viewer.data?.id;
  useEffect(() => api.onTokenChange(() => {
    void queryClient.resetQueries({ queryKey: ['place-entry'] });
  }), [queryClient]);
  const saved = useQuery({
    queryKey: ['place-entry', userId, 'saved'], queryFn: () => api.savedPlaces.getSavedPlaces(),
    enabled: !!userId && !viewer.isFetching, staleTime: 0, retry: false,
  });
  const places = (saved.data?.savedPlaces ?? []).filter((p) => p.user_id === userId);
  const active = savedPlaceId && savedPlaceId !== 'all' ? places.find((p) => p.id === savedPlaceId) : places[0];
  const preview = useQuery({
    queryKey: ['place-entry', userId, 'preview', active?.id],
    queryFn: () => api.place.getPublicPlacePreview(active!.label),
    enabled: !!active && !previewId && !viewer.isFetching, staleTime: 60_000, retry: false,
  });

  if (viewer.isPending || viewer.isFetching) return <p role="status">Loading your places…</p>;
  if (viewer.isError || !userId) return <ErrorState message="We could not load your account." onRetry={() => viewer.refetch()} />;
  if (previewId) return <PendingPlaceSaver key={`${previewId}:${userId}`} previewId={previewId} userId={userId} onSaved={(place) => {
    queryClient.setQueryData<{ savedPlaces: api.savedPlaces.SavedPlace[] }>(['place-entry', userId, 'saved'], (current) => ({
      savedPlaces: [place, ...(current?.savedPlaces ?? []).filter((p) => p.id !== place.id && p.user_id === userId)],
    }));
    void queryClient.invalidateQueries({ queryKey: ['place-entry', userId, 'saved'] });
    router.replace(`/app/place?savedPlace=${encodeURIComponent(place.id)}`);
  }} />;
  if (saved.isPending || (saved.isFetching && !active)) return <p role="status">Loading your saved places…</p>;
  if (saved.isError) return <ErrorState message="We could not load your saved places." onRetry={() => saved.refetch()} />;
  if (!active) return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-5">
      <h1 className="text-xl font-semibold">{savedPlaceId ? 'This saved place is unavailable' : 'Start with a place that matters to you'}</h1>
      <p className="mt-2 text-app-text-secondary">Preview an address and choose whether to save it privately. You can also browse Pulse and Beacons without adding a home.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <button className="text-primary-700 dark:text-primary-300" onClick={() => router.push('/start')}>Preview an address</button>
        <button className="text-primary-700 dark:text-primary-300" onClick={() => router.push('/app/feed?surface=personas')}>Browse Beacons</button>
        <button className="text-primary-700 dark:text-primary-300" onClick={() => router.push('/app/homes')}>Manage homes</button>
      </div>
    </section>
  );

  const setup = () => router.push(`/app/homes/new?savedPlace=${encodeURIComponent(active.id)}`);
  return (
    <div>
      <section className="rounded-2xl border border-app-border bg-app-surface p-5">
        <p className="text-sm text-app-text-secondary">Saved privately · Public address information</p>
        <h1 className="mt-1 break-words text-xl font-semibold">{active.label}</h1>
        {places.length > 1 ? <label className="mt-3 block text-sm">Saved place
          <select className="mt-1 block w-full rounded-lg border border-app-border bg-app-surface p-2" value={active.id} onChange={(event) => router.replace(`/app/place?savedPlace=${encodeURIComponent(event.target.value)}`)}>
            {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label> : null}
        <p className="mt-3 text-sm text-app-text-secondary">Household tools and verification are a separate step. Your saved address does not give access to anyone else’s household.</p>
        <div className="mt-4 flex flex-wrap gap-4">
          <button onClick={setup} className="font-semibold text-primary-700 dark:text-primary-300">Set up this home</button>
          <button disabled={removing} className="text-app-text-secondary disabled:opacity-50" onClick={async () => {
            setRemoving(true); setError('');
            try {
              await api.savedPlaces.remove(active.id);
              await queryClient.invalidateQueries({ queryKey: ['place-entry', userId, 'saved'] });
              router.replace('/app/place');
            } catch (err) { setError(extractApiError(err, 'Could not remove this saved place. Try again.')); }
            finally { setRemoving(false); }
          }}>{removing ? 'Removing…' : 'Remove saved place'}</button>
          <button onClick={() => router.replace('/app/place')} className="text-app-text-secondary">Home overview</button>
        </div>
        {error ? <p role="alert" className="mt-3 text-red-700 dark:text-red-300">{error}</p> : null}
      </section>
      {preview.isPending ? <p role="status" className="mt-4">Loading address information…</p> : null}
      {preview.isError ? <ErrorState message="Your address is saved. We could not refresh its public information." onRetry={() => preview.refetch()} /> : null}
      {preview.data && (preview.data.status === 'ready' || preview.data.status === 'partial') ? <PreviewBody preview={preview.data} onWall={setup} /> : null}
      {preview.data && (preview.data.status === 'unsupported_region' || preview.data.status === 'could_not_place') ? <p className="mt-4 text-app-text-secondary">Your address is saved. Public information is not available for this address yet.</p> : null}
    </div>
  );
}
