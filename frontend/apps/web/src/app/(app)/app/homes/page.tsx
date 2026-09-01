// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { Home } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

function claimInProgress(status) {
  return status === 'under_review';
}

export default function HomesPage() {
  const router = useRouter();
  const [homes, setHomes] = useState<Home[]>([]);
  const [pendingClaims, setPendingClaims] = useState<Array<{ claim: any; addressLine: string; cityLine: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) { router.push('/login'); return; }
      const [homesRes, claimsRes] = await Promise.all([
        api.homes.getMyHomes(),
        api.homeOwnership.getMyOwnershipClaims(),
      ]);
      const list = (homesRes as Record<string, any>)?.homes as Home[] ?? [];
      setHomes(list);
      const homeIds = new Set(list.map((h) => h.id));
      const claims = claimsRes?.claims ?? [];
      const pending = claims.filter((c) => claimInProgress(c.status) && c.home_id && !homeIds.has(c.home_id));
      const enriched = await Promise.all(
        pending.map(async (claim) => {
          try {
            const prof = await api.homes.getPublicHomeProfile(claim.home_id);
            const h = prof.home;
            const addressLine = h.name || h.address || 'Home';
            const cityLine = [h.city, h.state, h.zipcode].filter(Boolean).join(', ');
            return { claim, addressLine, cityLine };
          } catch {
            return { claim, addressLine: 'Home', cityLine: 'Ownership verification in progress' };
          }
        }),
      );
      setPendingClaims(enriched);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load homes');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const remove = async (homeId: string) => {
    const yes = await confirmStore.open({
      title: 'Delete this home?',
      description: 'This permanently removes the home for all members. Only the primary owner should do this.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!yes) return;
    try { await api.homes.deleteHome(homeId); await load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const leave = async (homeId: string) => {
    const yes = await confirmStore.open({
      title: 'Leave this home?',
      description: 'You will lose access to this home. You can be re-added later.',
      confirmLabel: 'Leave',
      variant: 'destructive',
    });
    if (!yes) return;
    try {
      await api.homes.leaveHome(homeId);
      toast.success('You left the home');
      await load();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'TRANSFER_REQUIRED'
        ? 'Primary owners must transfer ownership before leaving.'
        : (e instanceof Error ? e.message : 'Failed to leave');
      toast.error(msg);
    }
  };

  const removeClaim = async (claim: { id: string; home_id: string }) => {
    const yes = await confirmStore.open({
      title: 'Delete this claim?',
      description: 'This permanently removes your ownership claim and any uploaded evidence for this address.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!yes) return;
    setDeletingClaimId(claim.id);
    try {
      await api.homeOwnership.deleteMyOwnershipClaim(claim.home_id, claim.id);
      toast.success('Claim deleted');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete claim');
    } finally {
      setDeletingClaimId(null);
    }
  };

  return (
    <div className="bg-app-surface-raised">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-app-text">My Homes</h1>
          <Link href="/app/homes/new" className="px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-900">
            Add home
          </Link>
        </div>
        {loading ? (
          <div className="text-app-text-secondary">Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : homes.length === 0 && pendingClaims.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-6">
            <div className="text-lg font-semibold">No homes yet</div>
            <p className="mt-1 text-app-text-secondary">
              Add a home to post tasks from a verified place faster. If you submitted ownership proof for an address,
              it will appear under verification while your claim is in review.
            </p>
            <Link href="/app/homes/new" className="inline-block mt-4 px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-900">
              Add your first home
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {pendingClaims.length > 0 ? (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wide text-app-text-secondary mb-3">Verification in progress</h2>
                <div className="space-y-4">
                  {pendingClaims.map(({ claim, addressLine, cityLine }) => {
                    const q = claim.id ? `?claimId=${encodeURIComponent(claim.id)}` : '';
                    const busy = deletingClaimId === claim.id;
                    return (
                      <div
                        key={claim.id}
                        className="rounded-xl border border-violet-200 bg-violet-50/80 dark:bg-violet-950/30 dark:border-violet-800 p-5 flex flex-row items-stretch gap-3"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex-1 min-w-0 cursor-pointer text-left"
                          onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/app/homes/${claim.home_id}/claim-owner/evidence${q}`); }}
                          onClick={() => router.push(`/app/homes/${claim.home_id}/claim-owner/evidence${q}`)}
                        >
                          <div className="text-base font-semibold text-app-text">{addressLine}</div>
                          <div className="text-sm text-app-text-secondary">{cityLine}</div>
                          <div className="mt-2 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/50 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:text-violet-200">
                            Ownership claim · Under review
                          </div>
                          <p className="mt-2 text-xs text-app-text-secondary">
                            You are not a member of this home yet. Continue your claim or wait for review.
                          </p>
                          <p className="mt-2 text-sm text-app-text-secondary">Continue →</p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={(e) => { e.stopPropagation(); removeClaim(claim); }}
                          className="shrink-0 self-start px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? '…' : 'Delete'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {homes.length > 0 ? (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wide text-app-text-secondary mb-3">Your homes</h2>
                <div className="space-y-4">
                  {homes.map((h: Home) => {
                    const label = [h.address, h.address2].filter(Boolean).join(' ');
                    const cityLine = [h.city, h.state, h.zipcode].filter(Boolean).join(' ');
                    const occ = h.occupancy?.role || (h.owner_id ? 'owner' : 'member');
                    return (
                      <div key={h.id} className="rounded-xl border border-app-border bg-app-surface p-5 flex items-start justify-between gap-4">
                        <div className="cursor-pointer flex-1" onClick={() => router.push(`/app/homes/${h.id}/dashboard`)}>
                          <div className="text-base font-semibold text-app-text">{label}</div>
                          <div className="text-sm text-app-text-secondary">{cityLine}</div>
                          <div className="mt-2 inline-flex items-center rounded-full border border-app-border px-2.5 py-1 text-xs font-semibold text-app-text-strong">{occ}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/app/homes/${h.id}/dashboard`} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">Dashboard</Link>
                          {(h as { can_delete_home?: boolean }).can_delete_home ? (
                            <button type="button" onClick={() => remove(h.id)} className="px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50">Delete home</button>
                          ) : (
                            <button type="button" onClick={() => leave(h.id)} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">Leave</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
