// @ts-nocheck
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as api from '@pantopus/api';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import type { UserProfile, BusinessUser, Home } from '@pantopus/types';

type Tab = 'all' | 'people' | 'businesses' | 'homes';
type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';

function DiscoverPageContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  const [people, setPeople] = useState<UserProfile[]>([]);
  const [businesses, setBusinesses] = useState<BusinessUser[]>([]);
  const [homes, setHomes] = useState<Home[]>([]);

  const [personState, setPersonState] = useState<Record<string, { relationship: RelationshipState }>>({});
  const [businessFollowing, setBusinessFollowing] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const totalCount = people.length + businesses.length + homes.length;

  const runSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (q.length < 2) {
      setPeople([]);
      setBusinesses([]);
      setHomes([]);
      setPersonState({});
      setBusinessFollowing({});
      return;
    }

    setLoading(true);
    try {
      const [peopleRes, businessRes, homesRes] = await Promise.all([
        api.users.searchUsers(q, { type: 'people', limit: 20 }),
        api.businesses.discoverBusinesses({ q, limit: 20 }),
        api.homes.discoverHomes({ q, limit: 20 }),
      ]);

      const nextPeople = peopleRes.users || [];
      const nextBusinesses = businessRes.businesses || [];
      const nextHomes = homesRes.homes || [];

      setPeople(nextPeople);
      setBusinesses(nextBusinesses);
      setHomes(nextHomes);

      // Hydrate per-person relationship state for action buttons.
      const statusEntries = await Promise.all(
        nextPeople.map(async (p: UserProfile) => {
          try {
            const s = await api.users.getRelationshipStatus(p.id);
            return [p.id, { relationship: s.relationship as RelationshipState }] as const;
          } catch {
            return [p.id, { relationship: 'none' as RelationshipState }] as const;
          }
        })
      );
      setPersonState(Object.fromEntries(statusEntries));

      const bizFollowMap: Record<string, boolean> = {};
      for (const b of nextBusinesses) bizFollowMap[b.id] = !!b.following;
      setBusinessFollowing(bizFollowMap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) return;
    setQuery((prev) => (prev === q ? prev : q));
    void runSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const resolveConnectionId = async (targetUserId: string, mode: 'pending' | 'connected') => {
    if (mode === 'pending') {
      const pending = await api.relationships.getPendingRequests();
      const rel = (pending.requests || []).find((r: { requester?: { id?: string }; id?: string }) => r.requester?.id === targetUserId);
      return rel?.id || null;
    }
    const connected = await api.relationships.getConnections();
    const rel = (connected.relationships || []).find((r: { other_user?: { id?: string }; id?: string }) => r.other_user?.id === targetUserId);
    return rel?.id || null;
  };

  const handlePersonConnect = async (personId: string) => {
    setActionLoading((p) => ({ ...p, [`person-connect-${personId}`]: true }));
    try {
      const state = personState[personId]?.relationship || 'none';
      if (state === 'none') {
        await api.relationships.sendRequest(personId);
        setPersonState((p) => ({ ...p, [personId]: { relationship: 'pending_sent' } }));
      } else if (state === 'pending_received') {
        const relId = await resolveConnectionId(personId, 'pending');
        if (relId) {
          await api.relationships.acceptRequest(relId);
          setPersonState((p) => ({ ...p, [personId]: { relationship: 'connected' } }));
        }
      } else if (state === 'connected') {
        const relId = await resolveConnectionId(personId, 'connected');
        if (relId) {
          await api.relationships.disconnect(relId);
          setPersonState((p) => ({ ...p, [personId]: { relationship: 'none' } }));
        }
      }
    } finally {
      setActionLoading((p) => ({ ...p, [`person-connect-${personId}`]: false }));
    }
  };

  const handleBusinessFollow = async (businessId: string) => {
    setActionLoading((p) => ({ ...p, [`business-follow-${businessId}`]: true }));
    try {
      const following = !!businessFollowing[businessId];
      if (following) {
        await api.businesses.unfollowBusiness(businessId);
        setBusinessFollowing((p) => ({ ...p, [businessId]: false }));
      } else {
        await api.businesses.followBusiness(businessId);
        setBusinessFollowing((p) => ({ ...p, [businessId]: true }));
      }
    } finally {
      setActionLoading((p) => ({ ...p, [`business-follow-${businessId}`]: false }));
    }
  };

  const handleClaimHome = async (homeId: string) => {
    setActionLoading((p) => ({ ...p, [`home-claim-${homeId}`]: true }));
    try {
      const res = await api.homes.submitResidencyClaim(homeId);
      const resObj = res as Record<string, any>;
      const claim = resObj?.claim as Record<string, any> | undefined;
      const status = (claim?.status || 'pending') as string;
      setHomes((prev) => prev.map((h) => (h.id === homeId ? { ...h, claim_status: status } as Home : h)));
    } finally {
      setActionLoading((p) => ({ ...p, [`home-claim-${homeId}`]: false }));
    }
  };

  const visiblePeople = tab === 'all' || tab === 'people';
  const visibleBusinesses = tab === 'all' || tab === 'businesses';
  const visibleHomes = tab === 'all' || tab === 'homes';

  const connectionLabel = (r: RelationshipState) => {
    if (r === 'connected') return 'Connected';
    if (r === 'pending_sent') return 'Request Sent';
    if (r === 'pending_received') return 'Accept Request';
    if (r === 'blocked') return 'Blocked';
    return 'Connect';
  };

  const canRunSearch = query.trim().length >= 2;

  const headerText = useMemo(() => {
    if (!canRunSearch) return 'Type at least 2 characters to search.';
    if (loading) return 'Searching...';
    return `${totalCount} result${totalCount === 1 ? '' : 's'}`;
  }, [canRunSearch, loading, totalCount]);

  return (
    <div className="bg-app min-h-screen">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-app">Discover</h1>
          <p className="text-sm text-app-secondary mt-1">Find people, businesses, and homes. Connect, follow, or claim residency.</p>
        </div>

        <div className="rounded-xl border border-app bg-surface p-4 mb-5">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder="Search people, business names, or addresses"
              className="flex-1 rounded-lg border border-app-strong px-3 py-2 text-sm text-app bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => {
                void runSearch();
              }}
              className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
              disabled={loading || !canRunSearch}
            >
              Search
            </button>
          </div>
          <p className="mt-2 text-xs text-app-muted">{headerText}</p>
        </div>

        <div className="mb-4 flex gap-2">
          {[
            ['all', 'All'],
            ['people', 'People'],
            ['businesses', 'Businesses'],
            ['homes', 'Homes'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                tab === key ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-surface border-app-strong text-app-strong'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {visiblePeople && people.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-app mb-3">People</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {people.map((p) => {
                const status = personState[p.id] || { relationship: 'none' as RelationshipState };
                const connectBusy = !!actionLoading[`person-connect-${p.id}`];
                return (
                  <div key={p.id} className="rounded-lg border border-app bg-surface p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <UserIdentityLink
                        userId={p.id}
                        username={p.username}
                        displayName={p.name || p.username}
                        avatarUrl={p.profile_picture_url || p.profilePicture || null}
                        city={p.city}
                        state={p.state}
                        textClassName="font-semibold text-app hover:underline"
                      />
                      <p className="text-sm text-app-muted">@{p.username}</p>
                      <p className="text-xs text-app-muted">{[p.city, p.state].filter(Boolean).join(', ') || 'Location not set'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePersonConnect(p.id)}
                        disabled={connectBusy || status.relationship === 'pending_sent' || status.relationship === 'blocked'}
                        className="rounded-lg border border-app-strong px-3 py-1.5 text-sm text-app-strong disabled:opacity-50"
                      >
                        {connectBusy ? '...' : connectionLabel(status.relationship)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {visibleBusinesses && businesses.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-app mb-3">Businesses</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {businesses.map((b) => {
                const busy = !!actionLoading[`business-follow-${b.id}`];
                const following = !!businessFollowing[b.id];
                return (
                  <div key={b.id} className="rounded-lg border border-app bg-surface p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={b.username ? `/b/${b.username}` : '/app/discover'} className="font-semibold text-app hover:underline">
                        {b.name}
                      </Link>
                      <p className="text-xs text-app-muted">{(b.categories || []).slice(0, 3).join(' • ') || b.business_type || 'Business'}</p>
                      <p className="text-xs text-app-muted">{[b.city, b.state].filter(Boolean).join(', ')}</p>
                    </div>
                    <button
                      onClick={() => handleBusinessFollow(b.id)}
                      disabled={busy}
                      className={`rounded-lg px-3 py-1.5 text-sm border ${
                        following ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-app-strong text-app-strong'
                      }`}
                    >
                      {busy ? '...' : following ? 'Following' : 'Follow'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {visibleHomes && homes.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold text-app mb-3">Homes</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {homes.map((h) => {
                const busy = !!actionLoading[`home-claim-${h.id}`];
                const claimState = h.claim_status;
                const canClaim = !h.is_member && !claimState;
                return (
                  <div key={h.id} className="rounded-lg border border-app bg-surface p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/app/homes/${h.id}`} className="font-semibold text-app hover:underline">
                        {h.name || h.address}
                      </Link>
                      <p className="text-xs text-app-muted">{[h.city, h.state].filter(Boolean).join(', ')}</p>
                      <p className="text-xs text-app-muted">
                        {h.owner?.name ? `Owner: ${h.owner.name}` : 'Owner info unavailable'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/app/homes/${h.id}`}
                        className="rounded-lg border border-app-strong px-3 py-1.5 text-sm text-app-strong"
                      >
                        View
                      </Link>
                      {h.is_member ? (
                        <span className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700">Member</span>
                      ) : claimState === 'pending' ? (
                        <span className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm text-yellow-700">Claim Pending</span>
                      ) : (
                        <button
                          onClick={() => canClaim && handleClaimHome(h.id)}
                          disabled={!canClaim || busy}
                          className="rounded-lg border border-app-strong px-3 py-1.5 text-sm text-app-strong disabled:opacity-50"
                        >
                          {busy ? '...' : 'Claim'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {canRunSearch && !loading && totalCount === 0 && (
          <div className="rounded-xl border border-app bg-surface p-8 text-center text-app-secondary">
            No results found.
          </div>
        )}
      </main>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverPageContent />
    </Suspense>
  );
}
