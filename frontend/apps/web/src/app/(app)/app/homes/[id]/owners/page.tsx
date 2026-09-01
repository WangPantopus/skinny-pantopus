'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, User, ShieldCheck, Shield, ShieldAlert, ArrowLeftRight, Users } from 'lucide-react';
import * as api from '@pantopus/api';
import type { HomeOwner } from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const TIER_META: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  legal:    { icon: ShieldCheck, color: '#16a34a', label: 'Legal' },
  strong:   { icon: ShieldCheck, color: '#0284c7', label: 'Strong' },
  standard: { icon: Shield,      color: '#f59e0b', label: 'Standard' },
  weak:     { icon: ShieldAlert,  color: '#6b7280', label: 'Weak' },
};

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  verified: { color: 'text-green-700', bg: 'bg-green-100', label: 'Verified' },
  pending:  { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Pending' },
  disputed: { color: 'text-red-700',   bg: 'bg-red-100',   label: 'Disputed' },
  revoked:  { color: 'text-gray-500',  bg: 'bg-gray-100',  label: 'Revoked' },
};

function OwnersContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  const [owners, setOwners] = useState<HomeOwner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const fetchOwners = useCallback(async () => {
    if (!homeId) return;
    try {
      const res = await api.homeOwnership.getHomeOwners(homeId);
      setOwners(res.owners || []);
    } catch { toast.error('Failed to load owners'); }
  }, [homeId]);

  useEffect(() => { setLoading(true); fetchOwners().finally(() => setLoading(false)); }, [fetchOwners]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-app-text" />
          </button>
          <h1 className="text-xl font-bold text-app-text">Owners</h1>
        </div>
        <button
          onClick={() => router.push(`/app/homes/${homeId}/owners/invite`)}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition"
        >
          <UserPlus className="w-4 h-4" /> Invite
        </button>
      </div>

      {/* Owner list */}
      {owners.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 mx-auto text-app-text-muted mb-3" />
          <p className="text-sm text-app-text-secondary">No owners registered</p>
        </div>
      ) : (
        <div className="space-y-2">
          {owners.map((owner) => {
            const name = owner.user?.name || owner.user?.username || 'Unknown';
            const tier = TIER_META[owner.verification_tier] || TIER_META.weak;
            const TierIcon = tier.icon;
            const status = STATUS_BADGE[owner.owner_status] || STATUS_BADGE.pending;

            return (
              <div key={owner.id} className="flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4">
                <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-app-text truncate">{name}</p>
                    {owner.is_primary_owner && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <TierIcon className="w-3 h-3" style={{ color: tier.color }} />
                      <span style={{ color: tier.color }} className="font-medium">{tier.label}</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom action */}
      <div className="mt-6 pt-4 border-t border-app-border">
        <button
          onClick={() => router.push(`/app/homes/${homeId}/owners/transfer`)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-amber-300 bg-amber-50 text-amber-700 rounded-xl font-semibold text-sm hover:bg-amber-100 transition"
        >
          <ArrowLeftRight className="w-4 h-4" /> Transfer Ownership
        </button>
      </div>
    </div>
  );
}

export default function OwnersPage() { return <Suspense><OwnersContent /></Suspense>; }
