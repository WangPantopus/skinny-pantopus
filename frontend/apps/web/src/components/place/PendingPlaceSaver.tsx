'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
type SavedPlace = api.savedPlaces.SavedPlace;
import { bindPendingPlace, clearPendingPlace, type PendingPlace } from './pendingPlace';
import { extractApiError } from '@/lib/auth-utils';

/** Explicit confirmation. No mutation runs on mount or after authentication. */
export default function PendingPlaceSaver({ previewId, userId, onSaved }: {
  previewId: string;
  userId: string;
  onSaved: (place: SavedPlace) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PendingPlace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  useEffect(() => {
    setDraft(bindPendingPlace(previewId, userId));
    setLoaded(true);
  }, [previewId, userId]);

  async function save() {
    if (inFlight.current || !draft) return;
    // Re-read at confirmation: another tab may have cancelled or changed accounts.
    if (!bindPendingPlace(previewId, userId)) {
      setDraft(null);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const { savedPlace } = await api.savedPlaces.create({
        label: draft.label, latitude: draft.latitude, longitude: draft.longitude,
        city: draft.city, state: draft.state, expectedUserId: userId,
      });
      if (!savedPlace?.id || savedPlace.user_id !== userId) {
        throw new Error('The save could not be confirmed. Your preview is still here; try again.');
      }
      clearPendingPlace(previewId);
      onSaved(savedPlace);
    } catch (err) {
      setError(extractApiError(err, 'We could not save your place. Your preview is still here. Try again.'));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  if (!loaded) return <p role="status">Loading your preview…</p>;
  if (!draft) return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-5">
      <h1 className="text-xl font-semibold">This preview is no longer available</h1>
      <p className="mt-2 text-app-text-secondary">It may have expired, been cleared, or belong to another account. You can start a new preview or open your saved places.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <button onClick={() => router.push('/start')} className="text-primary-700 dark:text-primary-300">Start a new preview</button>
        <button onClick={() => router.replace('/app/place')} className="text-primary-700 dark:text-primary-300">Open Home</button>
      </div>
    </section>
  );

  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-5">
      <p className="text-sm text-app-text-secondary">Your address preview</p>
      <h1 className="mt-1 break-words text-xl font-semibold">{draft.label}</h1>
      <p className="mt-3 text-app-text-secondary">Save this address privately to your account so you can return to its public information. This does not join a household, verify residency, or share your address with neighbors.</p>
      {error ? <p role="alert" className="mt-3 text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button onClick={save} disabled={saving} className="rounded-xl bg-primary-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : error ? 'Retry save' : 'Save privately'}
        </button>
        <button disabled={saving} onClick={() => { clearPendingPlace(previewId); router.replace('/app/place'); }} className="text-app-text-secondary disabled:opacity-50">Not now</button>
      </div>
    </section>
  );
}
