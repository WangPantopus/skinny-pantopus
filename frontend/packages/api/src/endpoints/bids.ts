// ============================================================
// BIDS ENDPOINTS
// Convenience re-exports and aliases for bid-related operations.
// The canonical implementations live in the gigs module.
// ============================================================

import { post, get } from '../client';
import type { GigBid } from '@pantopus/types';

// Re-export the GigBid type so consumers can do api.bids.GigBid
export type { GigBid } from '@pantopus/types';

// Re-export canonical bid functions
export { placeBid, getGigBids, acceptBid, rejectBid, withdrawBid, getMyBids, updateBid } from './gigs';

/**
 * Alias for placeBid — used by BidModal component.
 * Accepts (gigId, data) instead of a single object.
 */
export async function createBid(
  gigId: string,
  data: {
    bid_amount: number;
    message?: string;
    proposed_time?: string | null;
    proposed_timeline?: string;
  },
): Promise<{ bid: GigBid }> {
  return post<{ bid: GigBid }>(`/api/gigs/${gigId}/bids`, data);
}

/**
 * Alias for getGigBids — used by BidsDrawer component.
 */
export async function listBidsForGig(gigId: string): Promise<{ bids: GigBid[] }> {
  return get<{ bids: GigBid[] }>(`/api/gigs/${gigId}/bids`);
}
