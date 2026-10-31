'use client';

// ============================================================
// Your homes (GET /api/homes/my-homes): one cache entry shared by Place, the
// Place switcher in the app shell (ProfileToggle) and My Homes (/app/homes),
// so they read it once and show the same list. Fresh for a minute (within the
// contract's 2 minutes for Homes and household); the `homes` change signal
// marks it out of date. A list with a guest home, a service provider's or
// access that ends is read again on every visit (decision 3).
// ============================================================

import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';
import { gatedStaleTime, showsMyHomesCopy } from '@/lib/householdCopy';

export type MyHomesReply = Awaited<ReturnType<typeof api.homes.getMyHomes>>;

export const MY_HOMES_FRESH_MS = 60 * 1000;

export function myHomesQuery() {
  return {
    queryKey: queryKeys.placeMyHomes(),
    queryFn: () => api.homes.getMyHomes(),
    staleTime: gatedStaleTime<MyHomesReply>(MY_HOMES_FRESH_MS, showsMyHomesCopy),
  };
}

export type MyClaimsReply = Awaited<ReturnType<typeof api.homeOwnership.getMyOwnershipClaims>>;
export type MyClaim = MyClaimsReply['claims'][number];

// Your own claims (GET /api/homes/my-ownership-claims), shared by My Homes and the Place pages. A claim
// doesn't make its Home one of yours until it's approved, so with no Home to open, Place, Today and Pulse
// name your claim in review instead of "no place". Only your own claims, so the copy shows at once, like
// your homes; the `homes` change signal marks it out of date.
export function myClaimsQuery() {
  return {
    queryKey: queryKeys.placeMyClaims(),
    queryFn: () => api.homeOwnership.getMyOwnershipClaims(),
    staleTime: MY_HOMES_FRESH_MS,
  };
}

/** Your claims still in review, newest first. */
export function claimsInReview(reply: MyClaimsReply | undefined): MyClaim[] {
  return (reply?.claims ?? []).filter((claim) => claim.status === 'under_review' && !!claim.home_id);
}

function claimedParts(claim: Pick<MyClaim, 'home'>): { line: string; city: string } {
  const line = [claim.home?.address, claim.home?.address2].map((part) => part?.trim()).filter(Boolean).join(' ');
  const city = [claim.home?.city, claim.home?.state].map((part) => part?.trim()).filter(Boolean).join(', ');
  return { line, city };
}

/** The address you claimed (street with any unit, then town), as the iOS and Android apps show it. */
export function claimAddress(claim: Pick<MyClaim, 'claim_type' | 'home'>): { line: string; city: string } {
  const { line, city } = claimedParts(claim);
  if (line) return { line, city };
  return { line: 'Home', city: city || (claim.claim_type === 'resident' ? 'Residency verification in progress' : 'Ownership verification in progress') };
}

/**
 * What a Place page says instead of "no place" while your claim is in review: `what` (Today, Your home…)
 * fills in once it's approved. Names the address you claimed when the server sent it. When a Pantopus
 * reviewer asked for more (Request info) and no document answered it yet, it says so; My Homes shows the note.
 */
export function claimInReviewNote(claim: Pick<MyClaim, 'home' | 'info_request'>, what: string): { title: string; description: string } {
  const { line, city } = claimedParts(claim);
  const claimed = line ? `You claimed ${[line, city].filter(Boolean).join(', ')}. ` : '';
  if (claim.info_request && !claim.info_request.responded_at) {
    return { title: 'Pantopus needs one more thing', description: `${claimed}A reviewer asked for something before they can finish your claim. Check its status to see the note.` };
  }
  return { title: 'Your claim is in review', description: `${claimed}${what} fills in here once a Pantopus reviewer approves your claim.` };
}
