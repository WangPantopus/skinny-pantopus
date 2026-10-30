'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { claimAddress, myClaimsQuery, myHomesQuery, type MyHomesReply } from '@/lib/myHomes';
import { showsMyHomesCopy } from '@/lib/householdCopy';
import { getAuthToken } from '@pantopus/api';
import { removalLink } from '@/components/home/member-removals/removalModel';
import { useSavedRemoval } from '@/components/home/member-removals/useSavedRemoval';
type MyHome = Awaited<ReturnType<typeof api.homes.getMyHomes>>['homes'][number];
type Claim = Awaited<ReturnType<typeof api.homeOwnership.getMyOwnershipClaims>>['claims'][number];
import { toast } from '@/components/ui/toast-store';
import { failureMessage } from '@/components/home/share/shareFailure';
import { confirmStore } from '@/components/ui/confirm-store';
import { validateResidencyPage, residencyRequestLabel, residencyReviewLabel } from '@/components/homes/residencyProgressModel';
import { unitText } from '@/components/homes/creation/homeCreationModel';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import ClaimApprovalChecklist, { claimStatusLabel, openInfoRequest } from '@/components/homes/ClaimApprovalChecklist';
import ClaimInfoRequestNote from '@/components/homes/ClaimInfoRequestNote';
import { EVERYTHING, RECONNECTED, onSyncTopic } from '@/lib/syncSignals';
type ResidencyRequest = Awaited<ReturnType<typeof api.homes.getMyResidencyRequests>>['requests'][number];
type PendingClaim = { claim: Claim; addressLine: string; cityLine: string };

// What My Homes last showed for this signed-in session (homes, claims and the first page of residency
// requests), so opening it again shows that at once and re-checks behind it. Tab memory only; the
// session marker changes on any sign-in, sign-out or account switch, so another account's copy never shows.
type PageCopy = { session: string; homes: MyHome[]; pendingClaims: PendingClaim[]; askedClaims: Claim[]; residencyRequests: ResidencyRequest[]; residencyCursor: string | null };
let lastPage: PageCopy | null = null;

function claimInProgress(status: string) {
  return status === 'under_review';
}

// Returning to the page (switching tabs, clicking back into the window) refreshes the list in
// the background at most this often. An account change always clears and reloads at once.
const FOCUS_REFRESH_MS = 30_000;

export default function HomesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Coming back shows at once what this page last showed, or your homes from the list Place and the
  // switcher share (lib/myHomes.ts); a re-check always runs behind it. Homes you asked to claim or join,
  // your claims and your residency requests show like your homes (founder, 2026-10-27). A list with a
  // guest home or access that ends shows nothing before the re-check (decision 3, lib/householdCopy.ts).
  const [seed] = useState<Omit<PageCopy, 'session'> | null>(() => {
    if (lastPage?.session === api.authSessionMarker() && showsMyHomesCopy({ homes: lastPage.homes })) return lastPage;
    const kept = queryClient.getQueryData<MyHomesReply>(myHomesQuery().queryKey);
    return showsMyHomesCopy(kept) && kept?.homes.length
      ? { homes: kept.homes, pendingClaims: [], askedClaims: [], residencyRequests: [], residencyCursor: null } : null;
  });
  const seeded = useRef(seed !== null);
  const [homes, setHomes] = useState<MyHome[]>(seed?.homes ?? []);
  const recheckOnResume = useRef(false);
  const savedRemoval = useSavedRemoval();
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>(seed?.pendingClaims ?? []);
  // Claims on homes listed under Your homes that a Pantopus reviewer asked more of (Request info).
  const [askedClaims, setAskedClaims] = useState<Claim[]>(seed?.askedClaims ?? []);
  const [loading, setLoading] = useState(!seeded.current);
  const [error, setError] = useState('');
  // Leaving keeps what's shown, unless a home on it may not show before its re-check.
  const mayKeep = useRef(false);
  mayKeep.current = !loading && !error && showsMyHomesCopy({ homes });
  const [residencyRequests, setResidencyRequests] = useState<ResidencyRequest[]>(seed?.residencyRequests ?? []);
  const [residencyCursor, setResidencyCursor] = useState<string | null>(seed?.residencyCursor ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [deletingClaimId, setDeletingClaimId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState('');
  const generation = useRef(0);
  const ready = useRef<(() => boolean) | null>(null);
  const lastAttempt = useRef(0);
  const inFlight = useRef(0);
  // A refresh that replaces the residency list bumps this, so an older "Load more" page isn't appended to it.
  const residencyEpoch = useRef(0);
  const morePages = useRef(false);
  const retire = useCallback(() => {
    generation.current++; ready.current = null; setHomes([]); setPendingClaims([]); setAskedClaims([]); setLoading(true);
    setResidencyRequests([]); setResidencyCursor(null); setLoadingMore(false); setMoreError(''); setRefreshError('');
  }, []);
  const abandon = useCallback(() => { generation.current++; ready.current = null; }, []);

  // A full load clears the page first. A background refresh keeps the list on screen and replaces it
  // only with a newer, verified answer for the same account; if it fails, the list stays with a notice.
  const load = useCallback(async (background = false) => {
    const revision = background ? generation.current : ++generation.current;
    lastAttempt.current = Date.now();
    if (!background) {
      ready.current = null; morePages.current = false;
      setHomes([]); setPendingClaims([]); setAskedClaims([]);
      setResidencyRequests([]); setResidencyCursor(null); setLoadingMore(false); setMoreError('');
      setLoading(true);
      setError('');
    }
    setRefreshError('');
    inFlight.current++;
    const token = getAuthToken(), origin = api.getApiBaseUrl(), session = api.authSessionMarker();
    let marker: string | null;
    const current = () => generation.current === revision && getAuthToken() === token
      && api.getApiBaseUrl() === origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === marker;
    try {
      marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
      if (!token) { router.push('/login'); return; }
      const [homesRes, claimsRes, residencyRes] = await Promise.all([
        // Read now (never from the copy), shared with any read already on its way, and kept for Place.
        queryClient.fetchQuery({ ...myHomesQuery(), staleTime: 0 }),
        // Kept for Place, Today and Pulse, which name a claim in review when there's no Home to open.
        queryClient.fetchQuery({ ...myClaimsQuery(), staleTime: 0 }),
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
      // A private task workspace is not a verification receipt. Keep its
      // document claim visible even though the Home already appears below.
      const homeIds = new Set(list.filter((h) => h.access_kind !== 'private_setup').map((h) => h.id));
      const claims = claimsRes?.claims;
      if (!Array.isArray(claims)) throw new Error('Your verification progress could not be loaded. Please retry.');
      // Each claim is named by the address you claimed (your own entry), as on iOS and Android.
      const enriched = claims.filter((c) => claimInProgress(c.status) && c.home_id && !homeIds.has(c.home_id))
        .map((claim) => { const { line, city } = claimAddress(claim); return { claim, addressLine: line, cityLine: city }; });
      const asked = claims.filter((c) => claimInProgress(c.status) && c.home_id && homeIds.has(c.home_id) && openInfoRequest(c));
      // A page that opened on the kept list becomes ready with its first confirmed answer.
      if (!background || ready.current === null) ready.current = current;
      setHomes(list); setPendingClaims(enriched); setAskedClaims(asked);
      // Keep the older requests someone already paged through; a refresh only renews the first page.
      if (!background || !morePages.current) {
        residencyEpoch.current++; setLoadingMore(false); setMoreError('');
        setResidencyRequests(residencyRes.requests); setResidencyCursor(residencyRes.next_cursor);
      }
      lastPage = showsMyHomesCopy({ homes: list }) ? { session, homes: list, pendingClaims: enriched, askedClaims: asked,
        residencyRequests: residencyRes.requests, residencyCursor: residencyRes.next_cursor } : null;
    } catch (e: unknown) {
      if (generation.current !== revision) return;
      if (background) { setRefreshError('Your homes couldn’t be refreshed, so this list may be out of date.'); return; }
      setHomes([]); setPendingClaims([]); setAskedClaims([]); ready.current = null;
      setError(e instanceof Error ? e.message : 'Failed to load homes');
    } finally {
      inFlight.current--;
      if (generation.current === revision) setLoading(false);
    }
  }, [router, queryClient]);

  const loadMoreResidency = async () => {
    const opening = ready.current, cursor = residencyCursor, epoch = residencyEpoch.current;
    if (!opening?.() || !cursor || loadingMore) return;
    const same = () => ready.current === opening && opening() && residencyEpoch.current === epoch;
    setLoadingMore(true); setMoreError('');
    try {
      const response = await api.homes.getMyResidencyRequests(cursor);
      if (!same()) return;
      validateResidencyPage(response);
      if (response.requests.some(r => r.id <= cursor || residencyRequests.some(existing => existing.id === r.id))) throw new Error('Your request history changed. Refresh My Homes to continue.');
      morePages.current = true;
      setResidencyRequests(previous => [...previous, ...response.requests]); setResidencyCursor(response.next_cursor);
    } catch (error) {
      if (same()) setMoreError(error instanceof Error ? error.message : 'Could not load more requests. Please retry.');
    } finally {
      if (same()) setLoadingMore(false);
    }
  };

  useEffect(() => {
    // Another account's list must never show, so an account change clears the page and reloads it.
    const restart = () => { lastPage = null; retire(); void load(); };
    // Coming back keeps the list visible and refreshes it behind the scenes (a full load only
    // after an error, when there's no list to keep).
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      if (recheckOnResume.current) {
        recheckOnResume.current = false;
        const revision = generation.current;
        // Cancel the older shared read before starting this visit's check.
        void queryClient.cancelQueries({ queryKey: myHomesQuery().queryKey, exact: true }).then(() => {
          if (generation.current === revision) void load();
        });
        return;
      }
      if (inFlight.current > 0
        || Date.now() - lastAttempt.current < FOCUS_REFRESH_MS) return;
      void load(ready.current !== null);
    };
    // Leaving means the page is hidden (another tab, a minimized or covered window). A window that only
    // loses focus (another app beside it, the address bar, DevTools) still shows the list, so it stays
    // and refreshes in place when focus returns.
    const leave = () => {
      if (mayKeep.current || recheckOnResume.current) return;
      recheckOnResume.current = true;
      retire();
    };
    const visibility = () => { if (document.visibilityState === 'hidden') leave(); else refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === api.AUTH_SESSION_CHANGE_KEY) restart(); };
    // The server says your homes changed (a claim or request decided, a Home added or left), or its
    // signals may have been missed: re-check quietly with the list on screen.
    const unsubscribeSync = onSyncTopic((topic) => {
      if ((topic === 'homes' || topic === RECONNECTED || topic === EVERYTHING)
        && inFlight.current === 0 && document.visibilityState !== 'hidden') void load(ready.current !== null);
    });
    // Opened on the kept list: the first load re-checks behind it instead of clearing the page.
    void load(seeded.current);
    const unsubscribe = api.onTokenChange(restart);
    window.addEventListener('focus', refresh); window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visibility);
    // Leaving the page drops any answer still on its way but keeps what's shown, so a remount (React's
    // development double mount included) opens on it instead of "Loading…".
    return () => { abandon(); unsubscribe(); unsubscribeSync();
      window.removeEventListener('focus', refresh); window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visibility); };
  }, [load, retire, abandon, queryClient]);

  // Back from Stripe's identity check (?identity_check=<claim id>): read the check once the claims
  // are listed, refresh the list and say where it stands.
  const identityReturn = useRef<string | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    const claimId = url.searchParams.get('identity_check');
    if (!claimId) return;
    identityReturn.current = claimId;
    url.searchParams.delete('identity_check');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  const identityPoll = useRef<(() => void) | null>(null);
  useEffect(() => () => identityPoll.current?.(), []);
  useEffect(() => {
    const claimId = identityReturn.current;
    const entry = claimId ? pendingClaims.find(({ claim }) => claim.id === claimId) : undefined;
    if (!claimId || !entry) return;
    identityReturn.current = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    identityPoll.current?.();
    identityPoll.current = () => { stopped = true; if (timer) clearTimeout(timer); };
    // While Stripe is still checking, look again a few times so the answer shows without a reload.
    const check = (round: number) => api.homeOwnership.getClaimIdentityCheck(entry.claim.home_id, claimId).then(({ approval }) => {
      if (stopped || !approval) return;
      setPendingClaims(previous => previous.map(item => item.claim.id === claimId
        ? { ...item, claim: { ...item.claim, approval } } : item));
      if (approval.identity === 'verified') toast.success('Your identity is confirmed.');
      else if (approval.identity === 'requires_input') toast.warning('Your ID check didn’t go through. You can try again.');
      else if (approval.identity === 'processing') {
        if (round === 0) toast.info('Thanks. Stripe is checking your ID; this usually takes a few minutes.');
        if (round < 12) timer = setTimeout(() => { void check(round + 1); }, 10_000);
      }
    }).catch(() => { /* the checklist keeps the last answer; the next refresh catches up */ });
    void check(0);
  }, [pendingClaims]);

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
    // The API client rejects with a plain object; keep the server's reason (e.g. linked records).
    catch (e: unknown) { toast.error(failureMessage(e, 'Failed')); }
  };

  const leave = (homeId: string) => {
    const opening = ready.current;
    if (!opening?.() || !homes.some(h => h.id === homeId && h.occupancy?.is_active === true)) return;
    router.push(removalLink(homeId, 'self'));
  };

  // Instant Claimed status for your own private setup (home_instant_claim).
  const instantClaim = useFeatureFlag('home_instant_claim');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const claimNow = async (homeId: string) => {
    const opening = ready.current;
    if (!opening?.() || claimingId || !homes.some(h => h.id === homeId && h.access_kind === 'private_setup')) return;
    setClaimingId(homeId);
    try {
      const result = await api.homes.instantClaimHome(homeId);
      if (result.claimed) toast.success('Your home is claimed. Invite your household from its dashboard.');
      else toast.info(result.message);
      if (ready.current === opening && opening()) await load();
    } catch (e: unknown) { toast.error(failureMessage(e, 'Could not claim this home. Please retry.')); }
    finally { setClaimingId(null); }
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
        {savedRemoval && <div className="mb-5"><Link href="/app/homes/member-removals" className="text-sm text-blue-700 dark:text-blue-400 underline">Check an unfinished removal</Link></div>}
        {!loading && !error && refreshError && (
          <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-app-border bg-app-surface p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{refreshError}</p>
            <button type="button" onClick={() => { if (inFlight.current === 0) void load(true); }} className="rounded-lg border border-app-border px-3 py-2 text-sm font-semibold">Retry</button>
          </div>
        )}
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
                    // A renter's residency document has its own status page; an ownership claim continues its evidence.
                    const residency = claim.claim_type === 'resident';
                    const hasPrivateSetup = homes.some((home) => home.id === claim.home_id && home.access_kind === 'private_setup');
                    const q = claim.id ? `?claimId=${encodeURIComponent(claim.id)}` : '';
                    const href = residency ? `/app/homes/${claim.home_id}/verify-residency${q}`
                      : `/app/homes/${claim.home_id}/claim-owner/evidence${q}`;
                    const busy = deletingClaimId === claim.id;
                    const asked = openInfoRequest(claim);
                    return (
                      <div
                        key={claim.id}
                        className="rounded-xl border border-violet-200 bg-violet-50/80 dark:bg-violet-950/30 dark:border-violet-800 p-5"
                      >
                      <div className="flex flex-row items-stretch gap-3">
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex-1 min-w-0 cursor-pointer text-left"
                          onKeyDown={(e) => { if (e.key === 'Enter') router.push(href); }}
                          onClick={() => router.push(href)}
                        >
                          <div className="text-base font-semibold text-app-text">{addressLine}</div>
                          <div className="text-sm text-app-text-secondary">{cityLine}</div>
                          <div className="mt-2 inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/50 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:text-violet-200">
                            {claimStatusLabel(claim)}
                          </div>
                          {asked ? <ClaimInfoRequestNote request={asked} className="mt-3" /> : null}
                          <p className="mt-2 text-xs text-app-text-secondary">
                            This claim does not grant household access.
                            {hasPrivateSetup ? ' Your private tasks remain available while verification is pending.' : ''}
                          </p>
                          <p className="mt-2 text-sm text-app-text-secondary">{asked ? 'Upload documents →' : 'Continue →'}</p>
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
                      {claim.approval ? (
                        <ClaimApprovalChecklist
                          homeId={claim.home_id}
                          claimId={claim.id}
                          residency={residency}
                          approval={claim.approval}
                          onUpload={() => router.push(href)}
                        />
                      ) : null}
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
                    // The address watch held this home's instant claim until the address is verified by mail.
                    const claimHeld = privateSetup && instantClaim && h.claim_held === true;
                    const verification = h.access_kind === 'verification';
                    const unit = !verification ? h.address2?.trim() : undefined;
                    // A renter's residency document is a residency request with its own status page, not an ownership claim.
                    const residencyDocument = !!h.pending_claim_id && h.pending_claim_type === 'resident';
                    const ownershipClaim = !!h.pending_claim_id && !residencyDocument;
                    const ownership = h.ownership_status === 'pending' || ownershipClaim;
                    const destination = privateSetup ? `/app/homes/${h.id}/tasks`
                      : verification ? ownership ? `/app/homes/${h.id}/claim-owner/evidence${ownershipClaim ? `?claimId=${encodeURIComponent(h.pending_claim_id as string)}` : ''}`
                        : residencyDocument ? `/app/homes/${h.id}/verify-residency/submitted`
                          : `/app/homes/${h.id}/residency` : `/app/homes/${h.id}/dashboard`;
                    const action = privateSetup ? 'Home tasks' : verification ? 'Check status' : 'Dashboard';
                    // A Pantopus reviewer asked more of this home's claim: the note, and where to send it.
                    const askedClaim = askedClaims.find((c) => c.home_id === h.id);
                    const askedRequest = askedClaim ? openInfoRequest(askedClaim) : null;
                    const askedHref = askedClaim ? `/app/homes/${h.id}/${askedClaim.claim_type === 'resident' ? 'verify-residency' : 'claim-owner/evidence'}?claimId=${encodeURIComponent(askedClaim.id)}` : null;
                    const occ = privateSetup ? 'Private setup' : verification ? (ownership ? 'Ownership verification pending' : 'Residency verification pending')
                      : ({ owner: 'Owner', admin: 'Administrator', manager: 'Manager', member: 'Member', lease_resident: 'Resident', restricted_member: 'Restricted member', guest: 'Guest', service_provider: 'Service provider' } as Record<string, string>)[h.role_base || ''] || 'Home access';
                    return (
                      <div key={h.id} className="rounded-xl border border-app-border bg-app-surface p-5 flex flex-col sm:flex-row items-start justify-between gap-4">
                        <Link href={destination} className="min-w-0 flex-1 break-words">
                          <div className="text-base font-semibold text-app-text">{label}</div>
                          {unit && <div className="text-sm text-app-text-secondary">{unitText(unit)}</div>}
                          <div className="text-sm text-app-text-secondary">{cityLine}</div>
                          <div className="mt-2 inline-flex items-center rounded-full border border-app-border px-2.5 py-1 text-xs font-semibold text-app-text-strong">{occ}</div>
                          {privateSetup && <p className="mt-2 text-sm text-app-text-secondary">{claimHeld
                            ? 'We need to check this address first. Verify it by mail to open your household tools.'
                            : instantClaim
                              ? 'Claim it now to use your household tools and invite your household. Verifying by mail later gets you neighbor messages and your verified badge.'
                              : 'Start with your own tasks while verification is pending.'}</p>}
                          {verification && <p className="mt-2 text-sm text-app-text-secondary">Household access is awaiting verification. Continue your request to see its current status.</p>}
                          {askedRequest ? <ClaimInfoRequestNote request={askedRequest} className="mt-3" /> : null}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2">
                          {privateSetup && instantClaim && !claimHeld && (
                            <button type="button" onClick={() => claimNow(h.id)} disabled={claimingId === h.id}
                              className="px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-60">
                              {claimingId === h.id ? 'Claiming…' : 'Claim it now'}
                            </button>
                          )}
                          {claimHeld && (
                            <Link href={`/app/homes/${h.id}/verify-postcard`}
                              className="px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-900">Verify by mail</Link>
                          )}
                          {askedHref && (
                            <Link href={askedHref} className="px-3 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-900">Upload documents</Link>
                          )}
                          <Link href={destination} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">{action}</Link>
                          {!verification && (privateSetup || residencyRequests.some(r => r.home_id === h.id)) && <Link href={`/app/homes/${h.id}/residency`} className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover">Residency status</Link>}
                          {(h as { can_delete_home?: boolean }).can_delete_home ? (
                            <button type="button" onClick={() => remove(h.id)} className="px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">Delete home</button>
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
