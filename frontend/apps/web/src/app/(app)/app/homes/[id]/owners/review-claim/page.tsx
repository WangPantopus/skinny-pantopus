'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Check, Flag, Shield, User, UserPlus, X } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', renter: 'Renter', household: 'Household',
  property_manager: 'Property Mgr', guest: 'Guest', member: 'Member',
};

type ClaimTab = 'ownership' | 'residency';

function ReviewClaimContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [claims, setClaims] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any | null>(null);
  const [residencyClaims, setResidencyClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClaimTab>('ownership');

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchClaims = useCallback(async () => {
    if (!homeId) return;
    const [ownershipRes, residencyRes, comparisonRes] = await Promise.allSettled([
      api.homeOwnership.getHomeOwnershipClaims(homeId),
      api.homes.getHomeClaims(homeId),
      api.homeOwnership.getOwnershipClaimComparison(homeId),
    ]);
    if (ownershipRes.status === 'fulfilled') setClaims(ownershipRes.value.claims || []);
    if (residencyRes.status === 'fulfilled') setResidencyClaims(residencyRes.value.claims || []);
    setComparison(comparisonRes.status === 'fulfilled' ? comparisonRes.value : null);
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchClaims().finally(() => setLoading(false)); }, [fetchClaims]);

  const handleOwnershipReview = useCallback(async (claimId: string, action: 'approve' | 'reject' | 'flag') => {
    const labels = { approve: 'Approve', reject: 'Reject', flag: 'Flag as suspicious' };
    const yes = await confirmStore.open({
      title: labels[action],
      description: `Are you sure you want to ${action} this ownership claim?`,
      confirmLabel: labels[action],
      variant: action === 'approve' ? 'primary' : 'destructive',
    });
    if (!yes) return;

    setActionLoading(claimId);
    try {
      await api.homeOwnership.reviewOwnershipClaim(homeId!, claimId, { action });
      toast.success(`Claim ${action === 'flag' ? 'flagged' : action + 'd'}`);
      await fetchClaims();
    } catch (err: any) { toast.error(err?.message || 'Failed to review claim'); }
    finally { setActionLoading(null); }
  }, [homeId, fetchClaims]);

  const handleRelationshipAction = useCallback(async (
    claim: any,
    action: 'invite_to_household' | 'decline_relationship' | 'flag_unknown_person',
  ) => {
    const claimId = claim.id;
    const isOwnerClaim = (claim.claim_type || 'owner') === 'owner';
    const actionMeta = {
      invite_to_household: {
        title: isOwnerClaim ? 'Invite claimant as owner' : 'Invite claimant to household',
        description: isOwnerClaim
          ? 'This sends a co-owner invitation. After identity confirmation, they become a verified owner of this home.'
          : 'This sends the claimant a merge invitation so they can attach to the verified household after identity confirmation.',
        confirmLabel: isOwnerClaim ? 'Invite as owner' : 'Send invite',
        variant: 'primary' as const,
      },
      decline_relationship: {
        title: 'Let review continue',
        description: 'This keeps the claimant on the normal review path without changing their evidence.',
        confirmLabel: 'Continue review',
        variant: 'primary' as const,
      },
      flag_unknown_person: {
        title: 'Flag unknown claimant',
        description: 'This marks the claimant for admin review.',
        confirmLabel: 'Flag claimant',
        variant: 'destructive' as const,
      },
    };

    const yes = await confirmStore.open(actionMeta[action]);
    if (!yes) return;

    setActionLoading(claimId);
    try {
      await api.homeOwnership.resolveOwnershipClaimRelationship(homeId!, claimId, { action });
      toast.success(action === 'invite_to_household' ? 'Invitation sent.' : 'Claim updated.');
      await fetchClaims();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update claimant relationship');
    } finally {
      setActionLoading(null);
    }
  }, [homeId, fetchClaims]);

  const handleResidencyReview = useCallback(async (claimId: string, action: 'approve' | 'reject') => {
    const labels = { approve: 'Approve', reject: 'Deny' };
    const yes = await confirmStore.open({
      title: labels[action],
      description: `Are you sure you want to ${action} this residency claim?`,
      confirmLabel: labels[action],
      variant: action === 'approve' ? 'primary' : 'destructive',
    });
    if (!yes) return;

    setActionLoading(claimId);
    try {
      if (action === 'approve') {
        await api.homes.approveResidencyClaim(homeId!, claimId);
      } else {
        await api.homes.rejectResidencyClaim(homeId!, claimId);
      }
      toast.success(`Claim ${action === 'approve' ? 'approved' : 'denied'}`);
      await fetchClaims();
    } catch (err: any) { toast.error(err?.message || `Failed to ${action} claim`); }
    finally { setActionLoading(null); }
  }, [homeId, fetchClaims]);

  const pendingClaims = comparison?.claims?.length
    ? comparison.claims.filter((claim: any) =>
      ['initiated', 'evidence_submitted', 'under_review', 'challenged'].includes(claim.claim_phase_v2)
    )
    : claims.filter((c: any) =>
      ['submitted', 'pending_review', 'pending_challenge_window', 'needs_more_info'].includes(c.state)
    );
  const pendingResidency = residencyClaims.filter((c: any) => c.status === 'pending');

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Review Claims</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['ownership', 'residency'] as ClaimTab[]).map((tab) => {
          const count = tab === 'ownership' ? pendingClaims.length : pendingResidency.length;
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition ${
                activeTab === tab ? 'bg-emerald-600 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>
              {tab} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Ownership Claims */}
      {activeTab === 'ownership' && (
        pendingClaims.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
            <p className="text-sm text-app-text-secondary">No pending ownership claims</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingClaims.map((claim: any) => (
              <div key={claim.id} className="bg-app-surface border border-app-border rounded-xl p-4">
                {/* Claimant info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-app-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app-text">
                      {claim.claimant?.name || claim.claimant?.username || 'Unknown claimant'}
                    </p>
                    <p className="text-xs text-app-text-muted">
                      Method: {claim.claimant?.method || claim.method || 'Unknown'}
                      {claim.claimant?.account_age_days != null && ` · Account: ${claim.claimant.account_age_days}d old`}
                    </p>
                  </div>
                  {(claim.claimant?.risk_score || claim.risk_score) != null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      (claim.claimant?.risk_score || claim.risk_score) > 50 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      Risk: {claim.claimant?.risk_score || claim.risk_score}
                    </span>
                  )}
                </div>

                {/* State badge */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                    {(claim.claim_phase_v2 || claim.state || '').replace(/_/g, ' ')}
                  </span>
                  {claim.claim_strength ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Strength: {String(claim.claim_strength).replace(/_/g, ' ')}
                    </span>
                  ) : null}
                  {claim.routing_classification ? (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      Route: {String(claim.routing_classification).replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </div>

                {claim.claim_phase_v2 === 'challenged' ? (
                  <div className="mb-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                    <p className="text-sm text-amber-800">
                      This claim is in the challenge path and should go through admin review.
                    </p>
                  </div>
                ) : null}

                {/* Actions */}
                {actionLoading === claim.id ? (
                  <div className="flex justify-center py-3">
                    <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
                  </div>
                ) : comparison?.incumbent?.has_verified_owner && ['initiated', 'evidence_submitted', 'under_review'].includes(claim.claim_phase_v2 || '') ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleRelationshipAction(claim, 'invite_to_household')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition">
                      <UserPlus className="w-4 h-4" /> {(claim.claim_type || 'owner') === 'owner' ? 'Invite as owner' : 'Invite'}
                    </button>
                    <button onClick={() => handleRelationshipAction(claim, 'decline_relationship')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-app-border bg-app-surface-sunken text-app-text rounded-lg text-sm font-semibold hover:bg-app-hover transition">
                      Continue review
                    </button>
                    <button onClick={() => handleRelationshipAction(claim, 'flag_unknown_person')} title="Flag unknown claimant"
                      className="w-10 h-10 flex items-center justify-center border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition">
                      <Flag className="w-4 h-4 text-amber-500" />
                    </button>
                  </div>
                ) : claim.claim_phase_v2 === 'challenged' ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-app-surface-sunken px-3 py-2 text-sm font-semibold text-app-text-secondary">
                    <Shield className="h-4 w-4" />
                    Admin review required
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOwnershipReview(claim.id, 'approve')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition">
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => handleOwnershipReview(claim.id, 'reject')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-200 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition">
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={() => handleOwnershipReview(claim.id, 'flag')} title="Flag as suspicious"
                      className="w-10 h-10 flex items-center justify-center border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100 transition">
                      <Flag className="w-4 h-4 text-amber-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Residency Claims */}
      {activeTab === 'residency' && (
        pendingResidency.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
            <p className="text-sm text-app-text-secondary">No pending residency claims</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingResidency.map((claim: any) => {
              const daysAgo = claim.created_at ? Math.floor((Date.now() - new Date(claim.created_at).getTime()) / 86400000) : null;
              return (
                <div key={claim.id} className="bg-app-surface border border-app-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-full bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-app-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-app-text">
                        {claim.claimant?.name || claim.claimant?.username || 'User'}
                      </p>
                      <p className="text-xs text-app-text-secondary">
                        Requesting: {ROLE_LABELS[claim.claimed_role] || 'Member'}
                      </p>
                    </div>
                    {daysAgo != null && <span className="text-xs text-app-text-muted">{daysAgo}d ago</span>}
                  </div>
                  {claim.claimed_address && (
                    <p className="text-xs text-app-text-secondary mb-3 truncate">{claim.claimed_address}</p>
                  )}

                  {actionLoading === claim.id ? (
                    <div className="flex justify-center py-3">
                      <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleResidencyReview(claim.id, 'approve')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition">
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => handleResidencyReview(claim.id, 'reject')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-200 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition">
                        <X className="w-4 h-4" /> Deny
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

export default function ReviewClaimPage() { return <Suspense><ReviewClaimContent /></Suspense>; }
