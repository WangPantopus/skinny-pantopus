'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import * as api from '@pantopus/api';
import Image from 'next/image';
import type { HomeResidencyClaim } from '@pantopus/types';
import UserIdentityLink from '@/components/user/UserIdentityLink';

interface ResidencyClaimsPanelProps {
  homeId: string;
  canManage: boolean;
}

export default function ResidencyClaimsPanel({ homeId, canManage }: ResidencyClaimsPanelProps) {
  const [claims, setClaims] = useState<HomeResidencyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const reviewPath = `/app/homes/${homeId}/owners/review-claim/residency`;

  useEffect(() => {
    const request = ++generation.current;
    setClaims([]); setLoadError(''); setLoading(canManage);
    if (!canManage) return;
    const token = api.getAuthToken(), origin = api.getApiBaseUrl();
    const marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
    const current = () => request === generation.current && token === api.getAuthToken()
      && origin === api.getApiBaseUrl() && marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY)
      && document.visibilityState !== 'hidden';
    void api.homes.getHomeClaims(homeId).then(result => {
      if (current()) setClaims(result.claims || []);
    }).catch(() => {
      if (current()) setLoadError('Current residency claims could not be loaded. Reload to check access.');
    }).finally(() => { if (current()) setLoading(false); });
    const retireGeneration = () => { generation.current++; };
    const invalidate = () => { retireGeneration(); setClaims([]); setLoading(true); setLoadError(''); };
    const changed = () => { invalidate(); setReload(n => n + 1); };
    const visibility = () => { if (document.visibilityState === 'hidden') invalidate(); else changed(); };
    const focus = () => { if (document.visibilityState !== 'hidden') changed(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const unsubscribe = api.onTokenChange(changed);
    window.addEventListener('storage', storage); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => { retireGeneration(); unsubscribe(); window.removeEventListener('storage', storage);
      window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility); };
  }, [homeId, canManage, reload]);

  if (!canManage) return null;

  const pendingClaims = claims.filter(c => c.status === 'pending');

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-5 h-5 text-yellow-700" />
        <h3 className="font-semibold text-yellow-800">
          Residency claims
        </h3>
      </div>

      <Link href={`${reviewPath}?from=members`} prefetch={false} className="mb-3 inline-block text-sm underline">Residency decisions and recovery</Link>
      {loading ? <p role="status" className="text-sm">Checking current residency claims…</p>
        : loadError ? <div role="alert" className="space-y-2 text-sm text-red-800"><p>{loadError}</p>
          <button className="underline" onClick={() => setReload(n => n + 1)}>Reload residency claims</button></div>
        : pendingClaims.length === 0 ? <p className="text-sm text-app-text-secondary">No pending residency claims</p> : null}
      <div className="space-y-3">
        {!loading && !loadError && pendingClaims.map((claim) => {
          const user = claim.claimant;
          const displayName = user?.name || (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : null) || user?.username || 'Unknown';

          return (
            <div key={claim.id} className="bg-app-surface rounded-lg border border-yellow-200 p-3 flex flex-wrap items-center gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {user?.profile_picture_url ? (
                  <Image src={user.profile_picture_url} alt={displayName} className="w-10 h-10 rounded-full object-cover" width={40} height={40} sizes="40px" quality={75} />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {user?.username ? (
                  <UserIdentityLink
                    userId={user?.id || null}
                    username={user.username}
                    displayName={displayName}
                    avatarUrl={user?.profile_picture_url || null}
                    city={user?.city || null}
                    state={user?.state || null}
                    textClassName="font-medium text-app-text hover:underline truncate"
                  />
                ) : (
                  <p className="font-medium text-app-text truncate">{displayName}</p>
                )}
                {user?.username && <p className="text-xs text-app-text-secondary">@{user.username}</p>}
                <p className="text-xs text-app-text-muted">
                  Claimed {new Date(claim.created_at).toLocaleDateString()}
                  {claim.claimed_address && ` - ${claim.claimed_address}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`${reviewPath}?claimId=${encodeURIComponent(claim.id)}&action=approve&from=members`} prefetch={false}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Review approval</Link>
                <Link href={`${reviewPath}?claimId=${encodeURIComponent(claim.id)}&action=reject&from=members`} prefetch={false}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium">Review rejection</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
