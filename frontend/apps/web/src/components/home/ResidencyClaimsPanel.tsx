'use client';

import { useState, useEffect, useCallback } from 'react';
import { Home } from 'lucide-react';
import * as api from '@pantopus/api';
import Image from 'next/image';
import type { HomeResidencyClaim } from '@pantopus/types';
import UserIdentityLink from '@/components/user/UserIdentityLink';
import { toast } from '@/components/ui/toast-store';

interface ResidencyClaimsPanelProps {
  homeId: string;
  canManage: boolean;
}

export default function ResidencyClaimsPanel({ homeId, canManage }: ResidencyClaimsPanelProps) {
  const [claims, setClaims] = useState<HomeResidencyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadClaims = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    try {
      const res = await api.homes.getHomeClaims(homeId);
      setClaims(res.claims || []);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [homeId, canManage]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleApprove = async (claimId: string) => {
    setActionLoading(claimId);
    try {
      await api.homes.approveResidencyClaim(homeId, claimId, 'member');
      await loadClaims();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (claimId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    setActionLoading(claimId);
    try {
      await api.homes.rejectResidencyClaim(homeId, claimId, reason || undefined);
      await loadClaims();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  if (!canManage) return null;

  const pendingClaims = claims.filter(c => c.status === 'pending');

  if (loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-yellow-200 rounded w-1/3" />
      </div>
    );
  }

  if (pendingClaims.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-5 h-5 text-yellow-700" />
        <h3 className="font-semibold text-yellow-800">
          {pendingClaims.length} Pending Residency Claim{pendingClaims.length !== 1 ? 's' : ''}
        </h3>
      </div>

      <div className="space-y-3">
        {pendingClaims.map((claim) => {
          const user = claim.claimant;
          const displayName = user?.name || (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : null) || user?.username || 'Unknown';

          return (
            <div key={claim.id} className="bg-app-surface rounded-lg border border-yellow-200 p-3 flex items-center gap-3">
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

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleApprove(claim.id)}
                  disabled={actionLoading === claim.id}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {actionLoading === claim.id ? '...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReject(claim.id)}
                  disabled={actionLoading === claim.id}
                  className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 font-medium"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
