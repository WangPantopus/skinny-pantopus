// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { HomeDashboard } from '@pantopus/types';
import UserIdentityLink from '@/components/user/UserIdentityLink';

export default function HomePublicProfilePage() {
  const params = useParams();
  const homeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<HomeDashboard | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.homes.getPublicHomeProfile(homeId);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load home profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-app-text-secondary">Loading home profile...</p>
      </div>
    );
  }

  if (error || !data?.home) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error || 'Home not found'}
        </div>
      </div>
    );
  }

  const home = data.home;
  const owner = data.owner;
  const claimStatus = data.claim?.status || null;
  const canClaim = !data.is_member && !claimStatus;

  return (
    <div className="bg-app-surface-raised min-h-screen">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <Link href="/app/discover" className="text-sm text-primary-700 hover:underline">← Back to Discover</Link>
        </div>

        <div className="rounded-2xl border border-app-border bg-app-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-app-text">{home.name || home.address}</h1>
              <p className="text-sm text-app-text-secondary mt-1">{[home.address, home.city, home.state, home.zipcode].filter(Boolean).join(', ')}</p>
              <p className="text-xs text-app-text-secondary mt-2">Home type: {home.home_type || 'not set'}</p>
              {owner?.name && (
                <p className="text-xs text-app-text-secondary mt-1">
                  Owner:{' '}
                  <UserIdentityLink
                    userId={owner.id}
                    username={owner.username}
                    displayName={owner.name}
                    avatarUrl={owner.profile_picture_url || null}
                    textClassName="text-primary-700 hover:underline"
                  />
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {data.is_member ? (
                <span className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-700">Member</span>
              ) : claimStatus === 'pending' ? (
                <Link href={`/app/homes/new?joinHome=${encodeURIComponent(homeId)}`}
                  className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm text-yellow-700">
                  Review residency request
                </Link>
              ) : claimStatus === 'rejected' || canClaim ? (
                <Link href={`/app/homes/new?joinHome=${encodeURIComponent(homeId)}`}
                  className="rounded-lg border border-app-border px-3 py-1.5 text-sm text-app-text-strong">
                  {claimStatus === 'rejected' ? 'Review and submit again' : 'Request residency'}
                </Link>
              ) : (
                <Link href="/app/homes" className="text-sm text-primary-700">Check My Homes</Link>
              )}
            </div>
          </div>

          {home.description && (
            <div className="mt-6 border-t border-app-border pt-4">
              <h2 className="text-sm font-semibold text-app-text mb-2">About this Home</h2>
              <p className="text-sm text-app-text-strong whitespace-pre-wrap">{home.description}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
