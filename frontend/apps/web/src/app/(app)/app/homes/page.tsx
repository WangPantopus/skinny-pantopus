'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
type MyHome = Awaited<ReturnType<typeof api.homes.getMyHomes>>['homes'][number];
type Claim = Awaited<ReturnType<typeof api.homeOwnership.getMyOwnershipClaims>>['claims'][number];
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import { validateResidencyPage, residencyRequestLabel, residencyReviewLabel } from '@/components/homes/residencyProgressModel';
type ResidencyRequest = Awaited<ReturnType<typeof api.homes.getMyResidencyRequests>>['requests'][number];

function claimInProgress(status: string) {
  return status === 'under_review';
}

export default function HomesPage() {
  const router = useRouter();
  const [homes, setHomes] = useState<MyHome[]>([]);
  const [pendingClaims, setPendingClaims] = useState<Array<{ claim: Claim; addressLine: string; cityLine: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [residencyRequests, setResidencyRequests] = useState<ResidencyRequest[]>([]);
  const [residencyCursor, setResidencyCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);
  const generation = useRef(0);
  const ready = useRef<(() => boolean) | null>(null);
  const retire = useCallback(() => {
    generation.current++; ready.current = null; setHomes([]); setPendingClaims([]); setLoading(true);
    setResidencyRequests([]); setResidencyCursor(null); setLoadingMore(false); setMoreError('');
  }, []);

  const load = useCallback(async () => {
    const revision = ++generation.current;
    ready.current = null;
    setHomes([]); setPendingClaims([]);
    setResidencyRequests([]); setResidencyCursor(null); setLoadingMore(false); setMoreError('');
    setLoading(true);
    setError('');
    const token = getAuthToken(), origin = api.getApiBaseUrl();
    let marker: string | null;
    const current = () => generation.current === revision && getAuthToken() === token
      && api.getApiBaseUrl() === origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker
      && document.visibilityState !== 'hidden';
    try {
      marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
      if (!token) { router.push('/login'); return; }
      const [homesRes, claimsRes, residencyRes] = await Promise.all([
        api.homes.getMyHomes(),
        api.homeOwnership.getMyOwnershipClaims(),
        api.homes.getMyResidencyRequests(),
      ]);
      if (!current()) return;
      validateResidencyPage(residencyRes);
      const list = homesRes?.homes;
      if (!Array.isArray(list) || list.some(h => !h || typeof h.id !== 'string'
        || (h.address2 != null && typeof h.address2 !== 'string')
        || !['shared', 'private_setup', 'verification'].includes(h.access_kind || '')
        || h.has_home_access !== (h.access_kind === 'shared') || typeof h.can_delete_home !== 'boolean'
        || !(h.occupancy === null || (h.occupancy && typeof h.occupancy.id === 'string'
          && typeof h.occupancy.is_active === 'boolean')))
        || new Set(list.map(h => h.id)).size !== list.length) throw new Error('Your Home list could not be verified. Please retry.');
      const homeIds = new Set(list.map((h) => h.id));
      const claims = claimsRes?.claims;
      if (!Array.isArray(claims)) throw new Error('Your verification progress could not be loaded. Please retry.');
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
      if (!current()) return;
      ready.current = current; setHomes(list); setPendingClaims(enriched);
      setResidencyRequests(residencyRes.requests); setResidencyCursor(residencyRes.next_cursor);
    } catch (e: unknown) {
      if (generation.current !== revision) return;
      setHomes([]); setPendingClaims([]); ready.current = null;
      setError(e instanceof Error ? e.message : 'Failed to load homes');
    } finally {
      if (generation.current === revision) setLoading(false);
    }
  }, [router]);

  const loadMoreResidency = async () => {
    const opening = ready.current, cursor = residencyCursor;
    if (!opening?.() || !cursor || loadingMore) return;
    setLoadingMore(true); setMoreError('');
    try {
      const response = await api.homes.getMyResidencyRequests(cursor);
      if (ready.current !== opening || !opening()) return;
      validateResidencyPage(response);
      if (response.requests.some(r => r.id <= cursor || residencyRequests.some(existing => existing.id === r.id))) throw new Error('Your request history changed. Refresh My Homes to continue.');
      setResidencyRequests(previous => [...previous, ...response.requests]); setResidencyCursor(response.next_cursor);
    } catch (error) {
      if (ready.current === opening && opening()) setMoreError(error instanceof Error ? error.message : 'Could not load more requests. Please retry.');
    } finally {
      if (ready.current === opening && opening()) setLoadingMore(false);
    }
  };

  useEffect(() => {
    const refresh = () => { retire(); if (document.visibilityState !== 'hidden') void load(); };
    const visibility = () => { if (document.visibilityState === 'hidden') retire(); else refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) refresh(); };
    void load();
    const unsubscribe = api.onTokenChange(refresh);
    window.addEventListener('focus', refresh); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    return () => { retire(); unsubscribe();
      window.removeEventListener('focus', refresh); window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility); };
  }, [load, retire]);

  const remove = async (homeId: string) => {
    const opening = ready.current;
    if (!opening?.() || !homes.some(h => h.id === homeId && h.can_delete_home === true)) return;
    const yes = await confirmStore.open({
      title: 'Delete this home?',
      description: 'This permanently removes the home for all members. Only the primary owner should do this.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!yes || ready.current !== opening || !opening()) return;
    try { await api.homes.deleteHome(homeId); await load(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed'); }
  };

  const leave = async (homeId: string) => {
    const opening = ready.current;
    if (!opening?.() || !homes.some(h => h.id === homeId && h.occupancy?.is_active === true)) return;
    const yes = await confirmStore.open({
      title: 'Leave this home?',
      description: 'You will lose access to this home. You can be re-added later.',
      confirmLabel: 'Leave',
      variant: 'destructive',
    });
    if (!yes || ready.current !== opening || !opening()) return;
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
    const opening = ready.current;
    if (!opening?.()) return;
    const yes = await confirmStore.open({
      title: 'Withdraw this claim?',
      description: 'This ends your pending claim. Its verification and audit history will be retained.',
      confirmLabel: 'Withdraw',
      variant: 'destructive',
    });
    if (!yes || ready.current !== opening || !opening()) return;
    setDeletingClaimId(claim.id);
    try {
      await api.homeOwnership.deleteMyOwnershipClaim(claim.home_id, claim.id);
      toast.success('Claim withdrawn');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to withdraw claim');
    } finally {
      setDeletingClaimId(null);
    }
  };

  const visibleHomes = homes.filter(h => h.access_kind !== 'verification' || h.ownership_status === 'pending' || h.pending_claim_id
    || !residencyRequests.some(r => r.home_id === h.id));
  const visibleRequests = residencyRequests.filter(r => !homes.some(h => h.id === r.home_id && h.access_kind !== 'verification'));
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
          <div role="alert" className="rounded-xl border border-app-border p-5">
            <p className="text-red-600">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-app-border px-3 py-2 text-sm font-semibold">Retry</button>
          </div>
        ) : homes.length === 0 && pendingClaims.length === 0 && residencyRequests.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-6">
            <div className="text-lg font-semibold">No homes yet</div>
            <p className="mt-1 text-app-text-secondary">
              Add a home to organize your own tasks. If you submitted ownership proof for an address,
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
                          {busy ? '…' : 'Withdraw'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {visibleHomes.length > 0 ? (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wide text-app-text-secondary mb-3">Your homes</h2>
                <div className="space-y-4">
                  {visibleHomes.map((h: MyHome) => {
                    const label = h.name || h.address || 'Home';
                    const cityLine = [h.city, h.state, h.zipcode].filter(Boolean).join(' ');
                    const privateSetup = h.access_kind === 'private_setup';
                    const verification = h.access_kind === 'verification';
                    const unit = !verification ? h.address2?.trim() : undefined;
                    const ownership = h.ownership_status === 'pending' || !!h.pending_claim_id;
                    const destination = privateSetup ? `/app/homes/${h.id}/tasks`
                      : verification ? ownership ? `/app/homes/${h.id}/claim-owner/evidence${h.pending_claim_id ? `?claimId=${encodeURIComponent(h.pending_claim_id)}` : ''}`
                        : `/app/homes/${h.id}/residency` : `/app/homes/${h.id}/dashboard`;
                    const action = privateSetup ? 'My tasks' : verification ? 'Check status' : 'Dashboard';
                    const occ = privateSetup ? 'Private setup' : verification ? (ownership ? 'Ownership verification pending' : 'Residency verification pending')
                      : ({ owner: 'Owner', admin: 'Administrator', manager: 'Manager', member: 'Member', lease_resident: 'Resident', restricted_member: 'Restricted member', guest: 'Guest', service_provider: 'Service provider' } as Record<string, string>)[h.role_base || ''] || 'Home access';
                    return (
                      <div key={h.id} className="rounded-xl border border-app-border bg-app-surface p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
                        <Link href={destination} className="min-w-0 flex-1 break-words">
                          <div className="text-base font-semibold text-app-text">{label}</div>
                          {unit && <div className="text-sm text-app-text-secondary">Unit {unit}</div>}
                          <div className="text-sm text-app-text-secondary">{cityLine}</div>
                          <div className="mt-2 inline-flex items-center rounded-full border border-app-border px-2.5 py-1 text-xs font-semibold text-app-text-strong">{occ}</div>
                          {privateSetup && <p className="mt-2 text-sm text-app-text-secondary">Start with your own tasks while verification is pending.</p>}
                          {verification && <p className="mt-2 text-sm text-app-text-secondary">Household access is awaiting verification. Continue your request to see its current status.</p>}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={destination} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">{action}</Link>
                          {!verification && (privateSetup || residencyRequests.some(r => r.home_id === h.id)) && <Link href={`/app/homes/${h.id}/residency`} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">Residency status</Link>}
                          {(h as { can_delete_home?: boolean }).can_delete_home ? (
                            <button type="button" onClick={() => remove(h.id)} className="px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50">Delete home</button>
                          ) : h.occupancy?.is_active === true ? (
                            <button type="button" onClick={() => leave(h.id)} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">Leave</button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {(visibleRequests.length > 0 || residencyCursor) && <section aria-labelledby="residency-requests-heading">
              <h2 id="residency-requests-heading" className="text-xs font-bold uppercase tracking-wide text-app-text-secondary mb-3">Your residency requests</h2>
              <p className="mb-4 text-sm text-app-text-secondary">These addresses come from your requests. Check status for current access and the next step.</p>
              <div className="space-y-4">
                {visibleRequests.map(request => (
                  <div key={request.id} className="rounded-xl border border-app-border bg-app-surface p-5">
                    <p className="font-semibold text-app-text break-words">{residencyRequestLabel(request)}</p>
                    <p className="mt-2 text-sm text-app-text-secondary">{residencyReviewLabel(request.status)}</p>
                    {request.home_id ? <Link href={`/app/homes/${request.home_id}/residency`} className="mt-3 inline-block rounded-lg border border-app-border px-3 py-2 text-sm font-semibold text-app-text hover:bg-app-hover">Check status</Link>
                      : <p className="mt-2 text-sm text-app-text-secondary">This historical request no longer has a Home destination.</p>}
                  </div>
                ))}
              </div>
              {moreError && <p role="alert" className="mt-3 text-sm text-red-600">{moreError}</p>}
              {residencyCursor && <button type="button" disabled={loadingMore} onClick={() => void loadMoreResidency()} className="mt-4 rounded-lg border border-app-border px-3 py-2 text-sm font-semibold disabled:opacity-50">{loadingMore ? 'Loading requests…' : 'Load more requests'}</button>}
            </section>}
          </div>
        )}
      </main>
    </div>
  );
}
