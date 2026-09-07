'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { BeaconFollowingItem } from '@pantopus/types';
import { webFeatureFlags } from '@/lib/featureFlags';

export default function BeaconsPage() {
  const client = useQueryClient();
  const viewer = useQuery({
    queryKey: ['beacons', 'viewer'],
    queryFn: () => api.users.getMyProfile(),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(
    () =>
      api.onTokenChange(() => {
        void client.resetQueries({ queryKey: ['beacons'] });
      }),
    [client],
  );
  if (viewer.isPending || viewer.isFetching)
    return (
      <p role="status" className="p-6">
        Loading Beacons…
      </p>
    );
  if (viewer.isError || !viewer.data?.id)
    return (
      <div className="p-6">
        <p role="alert">We couldn’t load your account.</p>
        <button onClick={() => viewer.refetch()}>Try again</button>
      </div>
    );
  return <BeaconDirectory key={viewer.data.id} userId={viewer.data.id} />;
}

function BeaconDirectory({ userId }: { userId: string }) {
  const client = useQueryClient();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const following = useQuery({
    queryKey: ['beacons', userId, 'following', offset],
    queryFn: () =>
      api.personas.getMyFollowing({ limit: 20, offset, sort: 'activity' }),
    retry: false,
  });
  const discovery = useQuery({
    queryKey: ['beacons', userId, 'search', search],
    queryFn: () =>
      api.identitySearch.searchProfiles({
        q: search,
        scope: 'public_profiles',
        limit: 20,
      }),
    enabled: search.length >= 2,
    retry: false,
  });
  const results = (discovery.data?.results ?? []).filter(
    (r) => r.type === 'public_profile' && /^\/@[a-zA-Z0-9_-]+$/.test(r.href),
  );

  async function manage(
    item: BeaconFollowingItem,
    action: 'mute' | 'unmute' | 'unfollow',
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(item.persona.id);
    setError('');
    setMessage('');
    try {
      if (action === 'unfollow')
        await api.personas.unfollowPersona(item.persona.id);
      else
        await api.personas.muteFollowing(
          item.persona.id,
          action === 'mute' ? 7 : null,
        );
      setMessage(
        action === 'unfollow'
          ? `Unfollowed ${item.persona.displayName}.`
          : action === 'mute'
            ? 'Notifications muted for seven days.'
            : 'Notification mute removed.',
      );
      await client.invalidateQueries({
        queryKey: ['beacons', userId, 'following'],
      });
    } catch {
      setError(
        'We couldn’t update this follow. Your previous settings are still shown. Try again.',
      );
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-app-text">Beacons</h1>
        <p className="mt-2 text-sm text-app-text-secondary">
          Follow public profiles that interest you. No home address or Beacon of
          your own is needed.
        </p>
        <nav
          aria-label="Beacon destinations"
          className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-primary-600"
        >
          <Link href="/app/feed?surface=personas">Read updates</Link>
          <Link href="/app/nearby">Pulse and Nearby</Link>
          {webFeatureFlags.persona ? (
            <Link href="/app/persona">My Beacon</Link>
          ) : null}
        </nav>
      </header>

      <section
        className="rounded-2xl border border-app-border bg-app-surface p-4"
        aria-labelledby="beacon-search-title"
      >
        <h2 id="beacon-search-title" className="font-bold text-app-text">
          Find a Beacon
        </h2>
        <p className="text-sm text-app-text-secondary mt-1">
          Search public names and handles across Pantopus.
        </p>
        <form
          className="flex gap-2 mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(input.trim());
          }}
        >
          <input
            aria-label="Beacon name or handle"
            value={input}
            maxLength={80}
            onChange={(event) => {
              setInput(event.target.value);
              if (!event.target.value.trim()) setSearch('');
            }}
            className="min-w-0 flex-1 rounded-xl border border-app-border bg-app-surface p-3 text-sm"
            placeholder="Name or handle"
          />
          <button
            disabled={input.trim().length < 2}
            className="rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Search
          </button>
        </form>
        {search.length >= 2 ? (
          <div className="mt-4">
            {discovery.isPending ? (
              <p role="status">Searching Beacons…</p>
            ) : discovery.isError ? (
              <div>
                <p role="alert">Beacon search is unavailable right now.</p>
                <button
                  className="mt-2 text-primary-600"
                  onClick={() => discovery.refetch()}
                >
                  Retry search
                </button>
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-app-text-secondary">
                No public Beacons matched “{search}”. Try another name or
                handle.
              </p>
            ) : (
              <ul className="divide-y divide-app-border">
                {results.map((result) => (
                  <li key={result.id}>
                    <Link href={result.href} className="block py-3">
                      <span className="font-semibold text-app-text">
                        {result.title}
                      </span>
                      {result.subtitle ? (
                        <span className="block text-sm text-app-text-secondary">
                          {result.subtitle}
                        </span>
                      ) : null}
                      <span className="text-xs text-primary-600">
                        View public profile
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="following-title">
        <h2 id="following-title" className="text-lg font-bold text-app-text">
          Beacons you follow
        </h2>
        {message ? (
          <p role="status" className="mt-2 text-sm text-app-text-secondary">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {following.isPending ? (
          <p role="status" className="mt-4">
            Loading who you follow…
          </p>
        ) : following.isError ? (
          <div className="mt-4">
            <p role="alert">We couldn’t load your followed Beacons.</p>
            <button
              className="mt-2 text-primary-600"
              onClick={() => following.refetch()}
            >
              Retry following
            </button>
          </div>
        ) : (
          <>
            {following.data?.items.length === 0 ? (
              <p className="mt-3 text-sm text-app-text-secondary">
                {offset
                  ? 'No more Beacons on this page.'
                  : 'Your followed Beacons will appear here. Search above, open a public profile, and choose Follow.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {following.data?.items.map((item) => {
                  const muted =
                    !!item.mutedUntil &&
                    new Date(item.mutedUntil).getTime() > Date.now();
                  return (
                    <li
                      key={item.membershipId}
                      className="rounded-2xl border border-app-border bg-app-surface p-4"
                    >
                      <Link
                        href={`/persona/${encodeURIComponent(item.persona.handle)}`}
                        className="font-bold text-app-text"
                      >
                        {item.persona.displayName}
                      </Link>
                      <p className="text-sm text-app-text-secondary">
                        @{item.persona.handle}
                        {item.persona.status === 'paused' ? ' · Paused' : ''}
                        {muted ? ' · Notifications muted' : ''}
                      </p>
                      {item.latestPost ? (
                        <Link
                          href={`/app/feed?surface=personas&post=${encodeURIComponent(item.latestPost.id)}`}
                          className="mt-2 block text-sm text-app-text-secondary"
                        >
                          {item.latestPost.snippet || 'Read the latest update'}
                          {item.unreadCount > 0 ? (
                            <span className="block text-xs font-semibold text-primary-600">
                              {item.unreadCount} unread updates
                            </span>
                          ) : null}
                        </Link>
                      ) : (
                        <p className="mt-2 text-sm text-app-text-secondary">
                          No updates yet.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-primary-600">
                        <button
                          disabled={busy !== null}
                          onClick={() =>
                            manage(item, muted ? 'unmute' : 'mute')
                          }
                        >
                          {busy === item.persona.id
                            ? 'Updating…'
                            : muted
                              ? 'Unmute'
                              : 'Mute for 7 days'}
                        </button>
                        {item.paidTier ? (
                          <Link
                            href={`/app/audience/membership/${encodeURIComponent(item.persona.id)}`}
                          >
                            Manage membership
                          </Link>
                        ) : (
                          <button
                            disabled={busy !== null}
                            onClick={() => manage(item, 'unfollow')}
                          >
                            Unfollow
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex gap-4 mt-4 text-sm font-semibold text-primary-600">
              {offset > 0 ? (
                <button onClick={() => setOffset(Math.max(0, offset - 20))}>
                  Previous
                </button>
              ) : null}
              {following.data?.pagination.hasMore &&
              following.data.pagination.nextOffset != null ? (
                <button
                  onClick={() =>
                    setOffset(following.data!.pagination.nextOffset!)
                  }
                >
                  Next
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
