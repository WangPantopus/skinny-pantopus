// ============================================================
// GIG ENDPOINTS
// Gig marketplace - posting, bidding, completion
// ============================================================

import { get, post, put, patch, del } from '../client';
import type { ApiRequestConfig } from '../client';
import type {
  Gig,
  GigBid,
  GigListItem,
  GigWithDetails,
  GigCreateForm,
  GigCreateRequest,
  GigFilters,
  ApiResponse,
  BrowseResponse,
} from '@pantopus/types';

type GigRecord = Record<string, unknown> & Partial<GigListItem & GigWithDetails>;

type PublicGigBrowseParams = GigFilters & {
  page?: number;
  limit?: number;
  offset?: number;
};

function normalizeStatusValue(rawStatus: unknown): string | string[] | undefined {
  if (rawStatus == null) return undefined;

  const values = (Array.isArray(rawStatus) ? rawStatus : [rawStatus]).reduce<string[]>(
    (acc, entry) => {
      const value = String(entry ?? '').trim();
      if (!value) return acc;

      const unwrapped =
        value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
      const parts = unwrapped
        .split(',')
        .map((part) => part.trim().replace(/^['"]+|['"]+$/g, ''))
        .filter((part): part is string => Boolean(part));

      acc.push(...parts);
      return acc;
    },
    []
  );

  const unique = Array.from(new Set(values));
  if (unique.length === 0) return undefined;
  if (unique.length === 1) return unique[0];
  return unique;
}

function extractFirstImage(attachments: unknown): string | null {
  if (!Array.isArray(attachments)) return null;
  for (const attachment of attachments) {
    if (typeof attachment === 'string' && /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(attachment)) {
      return attachment;
    }
  }
  return null;
}

function normalizeBidCount(gig: GigRecord): number | undefined {
  const candidates = [gig.bid_count, gig.bidsCount, gig.bids_count];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeDistanceMeters(gig: GigRecord): number | null | undefined {
  if (gig.distance_meters != null) {
    const parsed = Number(gig.distance_meters);
    return Number.isFinite(parsed) ? parsed : gig.distance_meters == null ? null : undefined;
  }

  if (gig.distance_km != null) {
    const parsedKm = Number(gig.distance_km);
    if (Number.isFinite(parsedKm)) return Math.round(parsedKm * 1000);
  }

  return undefined;
}

export function normalizeGigSummary<T extends GigRecord>(gig: T): T & GigListItem {
  const bidCount = normalizeBidCount(gig);
  const distanceMeters = normalizeDistanceMeters(gig);
  const firstImage =
    typeof gig.first_image === 'string' && gig.first_image.length > 0
      ? gig.first_image
      : extractFirstImage(gig.attachments);

  return {
    ...gig,
    ...(bidCount != null ? { bid_count: bidCount, bidsCount: bidCount } : {}),
    ...(distanceMeters !== undefined ? { distance_meters: distanceMeters } : {}),
    viewer_has_saved: Boolean(gig.viewer_has_saved),
    first_image: firstImage ?? null,
  } as T & GigListItem;
}

export function normalizeGigSummaries<T extends GigRecord>(gigs: T[] = []): Array<T & GigListItem> {
  return gigs.map((gig) => normalizeGigSummary(gig));
}

export function normalizeGigDetail<T extends GigRecord>(gig: T): T & GigWithDetails {
  return {
    ...normalizeGigSummary(gig),
    viewer_has_saved: Boolean(gig.viewer_has_saved),
  } as T & GigWithDetails;
}

function normalizeGigResponseList(gigs: GigRecord[] = []): GigWithDetails[] {
  return normalizeGigSummaries(gigs) as unknown as GigWithDetails[];
}

function cleanNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildPublicGigBrowseParams(
  filters?: PublicGigBrowseParams
): Record<string, unknown> | undefined {
  if (!filters) return undefined;

  const params: Record<string, unknown> = {};
  const status = normalizeStatusValue(filters.status);

  if (status !== undefined) params.status = status;
  if (filters.page != null) params.page = filters.page;
  if (filters.limit != null) params.limit = filters.limit;
  if (filters.offset != null) params.offset = filters.offset;
  if (filters.category) params.category = filters.category;
  if (filters.user_id) params.user_id = filters.user_id;
  if (filters.userId) params.userId = filters.userId;
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.sort) params.sort = filters.sort;
  if (filters.sort_by) params.sort_by = filters.sort_by;
  if (filters.sort_order) params.sort_order = filters.sort_order;
  if (filters.deadline) params.deadline = filters.deadline;
  if ((filters as Record<string, unknown>).engagement_mode) {
    params.engagement_mode = (filters as Record<string, unknown>).engagement_mode;
  }
  if ((filters as Record<string, unknown>).schedule_type) {
    params.schedule_type = (filters as Record<string, unknown>).schedule_type;
  }
  if ((filters as Record<string, unknown>).pay_type) {
    params.pay_type = (filters as Record<string, unknown>).pay_type;
  }

  const minPrice = cleanNumber(filters.minPrice ?? filters.budget_min);
  const maxPrice = cleanNumber(filters.maxPrice ?? filters.budget_max);
  const latitude = cleanNumber(filters.latitude);
  const longitude = cleanNumber(filters.longitude);
  const radiusMiles = cleanNumber(filters.radiusMiles);
  const maxDistance = cleanNumber(filters.max_distance);

  if (minPrice != null) params.minPrice = minPrice;
  if (maxPrice != null) params.maxPrice = maxPrice;
  if (latitude != null) params.latitude = latitude;
  if (longitude != null) params.longitude = longitude;
  if (radiusMiles != null) params.radiusMiles = radiusMiles;
  if (maxDistance != null) params.max_distance = maxDistance;
  if (typeof filters.includeRemote === 'boolean') params.includeRemote = filters.includeRemote;

  return params;
}

export function buildGigInBoundsParams(params: {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  status?: string | string[];
  includeRemote?: boolean;
  category?: string;
}): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    min_lat: params.min_lat,
    min_lon: params.min_lon,
    max_lat: params.max_lat,
    max_lon: params.max_lon,
  };

  const status = normalizeStatusValue(params.status);
  if (status !== undefined) normalized.status = status;
  if (typeof params.includeRemote === 'boolean') normalized.includeRemote = params.includeRemote;
  if (params.category) normalized.category = params.category;

  return normalized;
}

/**
 * Get gigs with filters and pagination
 */
export async function getGigs(
  filters?: GigFilters & {
    page?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{
  gigs: GigWithDetails[];
  total: number | null;
  limit: number;
  offset: number;
  pagination?: { limit: number; offset: number; hasMore: boolean };
}> {
  const response = await get<{
    gigs: GigWithDetails[];
    total: number | null;
    limit: number;
    offset: number;
    pagination?: { limit: number; offset: number; hasMore: boolean };
  }>('/api/gigs', buildPublicGigBrowseParams(filters));

  return {
    ...response,
    gigs: normalizeGigResponseList((response as Record<string, unknown>).gigs as GigRecord[]),
  };
}

/**
 * Get a single gig by ID with full details
 */
export async function getGig(gigId: string): Promise<{ gig: GigWithDetails }> {
  const response = await get<{ gig: GigWithDetails }>(`/api/gigs/${gigId}`);
  const rawGig = ((response as Record<string, unknown>).gig ?? response) as GigRecord;
  return {
    ...response,
    gig: normalizeGigDetail(rawGig),
  };
}

/**
 * Alias for getGig - Get a single gig by ID
 */
export async function getGigById(gigId: string): Promise<GigWithDetails> {
  const response = await getGig(gigId);
  return response.gig;
}

/**
 * Create a new gig
 */
export async function createGig(data: GigCreateForm): Promise<{ gig: Gig }> {
  return post<{ gig: Gig }>('/api/gigs', data);
}

/**
 * Create a new gig (Web MVP DTO aligned to current backend route)
 */
export async function createGigV2(data: GigCreateRequest): Promise<{ gig: Gig }> {
  return post<{ gig: Gig }>('/api/gigs', data as any);
}

/**
 * Update a gig
 */
export async function updateGig(
  gigId: string,
  data: Partial<GigCreateForm>
): Promise<{ gig: Gig }> {
  return patch<{ gig: Gig }>(`/api/gigs/${gigId}`, data);
}

/**
 * Delete a gig
 */
export async function deleteGig(gigId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/gigs/${gigId}`);
}

/**
 * Place a bid on a gig
 */
export async function placeBid(data: {
  gig_id: string;
  amount: number;
  bid_amount?: number; // Alias for amount
  proposed_timeline?: string;
  message?: string;
}): Promise<{ bid: GigBid }> {
  const { gig_id, amount, bid_amount, ...rest } = data;
  const bidAmount = amount || bid_amount;

  return post<{ bid: GigBid }>(`/api/gigs/${gig_id}/bids`, {
    bid_amount: bidAmount,
    ...rest,
  });
}

/**
 * Update an existing bid (bidder only)
 */
export async function updateBid(
  gigId: string,
  bidId: string,
  data: {
    amount?: number;
    bid_amount?: number;
    message?: string | null;
    proposed_time?: string | null;
  }
): Promise<{ bid: GigBid }> {
  const payload = {
    bid_amount: data.amount ?? data.bid_amount,
    message: data.message ?? null,
    proposed_time: data.proposed_time ?? null,
  };
  return put<{ bid: GigBid }>(`/api/gigs/${gigId}/bids/${bidId}`, payload);
}

/**
 * Get all bids for a gig (poster only)
 */
export async function getGigBids(gigId: string): Promise<{ bids: GigBid[] }> {
  return get<{ bids: GigBid[] }>(`/api/gigs/${gigId}/bids`);
}

/**
 * Accept a bid (poster only)
 */
export interface AcceptBidResponse {
  gig: Gig;
  bid: GigBid;
  paymentRequired?: boolean;
  requiresPaymentSetup?: boolean;
  isSetupIntent?: boolean;
  payment?: {
    clientSecret?: string | null;
    paymentId?: string | null;
    setupIntentId?: string | null;
    paymentIntentId?: string | null;
  } | null;
  clientSecret?: string | null;
  paymentId?: string | null;
  setupIntentId?: string | null;
  paymentIntentId?: string | null;
  roomId?: string | null;
}

export async function acceptBid(gigId: string, bidId: string): Promise<AcceptBidResponse> {
  return post<AcceptBidResponse>(`/api/gigs/${gigId}/bids/${bidId}/accept`);
}

/**
 * Finalize a pending_payment bid acceptance after payment is authorized.
 * Assigns the gig, rejects other bids, sends notifications.
 */
export async function finalizeAccept(gigId: string, bidId: string): Promise<AcceptBidResponse> {
  return post<AcceptBidResponse>(`/api/gigs/${gigId}/bids/${bidId}/finalize-accept`);
}

/**
 * Abort a pending_payment bid acceptance. Reverts bid to pending, cancels Stripe intent.
 */
export async function abortAccept(
  gigId: string,
  bidId: string,
): Promise<{ bid: GigBid; message: string }> {
  return post<{ bid: GigBid; message: string }>(`/api/gigs/${gigId}/bids/${bidId}/abort-accept`);
}

/**
 * Get (or create) the gig chat room for this gig.
 * Access: gig owner OR accepted worker.
 */
export async function getGigChatRoom(
  gigId: string
): Promise<{ roomId: string; topicId?: string; gigOwnerId?: string }> {
  return get<{ roomId: string; topicId?: string; gigOwnerId?: string }>(
    `/api/gigs/${gigId}/chat-room`
  );
}

/**
 * Worker starts the gig: assigned -> in_progress
 */
export async function startGig(gigId: string): Promise<{ gig: Gig }> {
  return post<{ gig: Gig }>(`/api/gigs/${gigId}/start`);
}

/**
 * Worker marks gig completed: in_progress -> completed
 * @param proof - Optional proof of completion: note, photos, checklist
 */
export async function markGigCompleted(
  gigId: string,
  proof?: { note?: string; photos?: string[]; checklist?: { item: string; done: boolean }[] }
): Promise<{ gig: Gig }> {
  return post<{ gig: Gig }>(`/api/gigs/${gigId}/mark-completed`, proof || {});
}

/**
 * Owner confirms completion (explicit endpoint)
 * @param data - Optional satisfaction rating and note
 */
export async function confirmGigCompletion(
  gigId: string,
  data?: { satisfaction?: number; note?: string }
): Promise<{ gig: Gig }> {
  return post<{ gig: Gig }>(`/api/gigs/${gigId}/confirm-completion`, data || {});
}

/**
 * Reject a bid (poster only)
 */
export async function rejectBid(gigId: string, bidId: string): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/gigs/${gigId}/bids/${bidId}/reject`);
}

/**
 * Reopen bidding for an assigned gig (poster only).
 * Moves gig back to open and restores previously rejected bids to pending.
 */
export async function reopenBidding(
  gigId: string,
  options?: { rollbackMode?: 'payment_setup_aborted' }
): Promise<{
  gig: Gig;
  reopened_count: number;
  accepted_bid_restored?: boolean;
  message: string;
}> {
  return post<{
    gig: Gig;
    reopened_count: number;
    accepted_bid_restored?: boolean;
    message: string;
  }>(`/api/gigs/${gigId}/reopen-bidding`, options || {});
}

/**
 * Withdraw a bid (bidder only)
 * @param reason - Optional: 'schedule_conflict' | 'underpriced' | 'mistake' | 'other'
 */
export async function withdrawBid(
  gigId: string,
  bidId: string,
  reason?: string
): Promise<ApiResponse & { rebid_available_at?: string }> {
  return del<ApiResponse & { rebid_available_at?: string }>(`/api/gigs/${gigId}/bids/${bidId}`, {
    reason,
  });
}

/**
 * Cancel bid alias
 */
export async function cancelBid(gigId: string, bidId: string, reason?: string) {
  return withdrawBid(gigId, bidId, reason);
}

/**
 * Send a counter-offer to a bidder (poster only)
 */
export async function counterBid(
  gigId: string,
  bidId: string,
  data: { amount: number; message?: string }
): Promise<{ bid: GigBid }> {
  return post<{ bid: GigBid }>(`/api/gigs/${gigId}/bids/${bidId}/counter`, data);
}

/**
 * Accept a counter-offer (bidder only)
 */
export async function acceptCounter(gigId: string, bidId: string): Promise<{ bid: GigBid }> {
  return post<{ bid: GigBid }>(`/api/gigs/${gigId}/bids/${bidId}/counter/accept`);
}

/**
 * Decline a counter-offer (bidder only)
 */
export async function declineCounter(gigId: string, bidId: string): Promise<{ bid: GigBid }> {
  return post<{ bid: GigBid }>(`/api/gigs/${gigId}/bids/${bidId}/counter/decline`);
}

/**
 * Withdraw a pending counter-offer (poster only)
 */
export async function withdrawCounter(gigId: string, bidId: string): Promise<{ bid: GigBid }> {
  return post<{ bid: GigBid }>(`/api/gigs/${gigId}/bids/${bidId}/counter/withdraw`);
}

/**
 * Get bidding metrics/stats for the current user
 */
export async function getBidStats(): Promise<{
  bids_submitted: number;
  bids_pending: number;
  bids_accepted: number;
  bids_rejected: number;
  bids_withdrawn: number;
  bids_expired: number;
  accept_rate: number;
}> {
  return get('/api/gigs/bid-stats');
}

/**
 * Owner confirms completion (alias of /confirm-completion)
 */
export async function completeGig(
  gigId: string,
  data?: {
    rating?: number;
    review?: string;
  }
): Promise<{ gig: Gig }> {
  return post<{ gig: Gig }>(`/api/gigs/${gigId}/complete`, data);
}

/**
 * Cancel a gig (poster or worker)
 */
export async function cancelGig(
  gigId: string,
  reason?: string
): Promise<{
  gig: Gig;
  cancellation: {
    zone: number;
    zone_label: string;
    fee: number;
    in_grace: boolean;
    cancelled_by: 'poster' | 'worker';
  };
}> {
  return post(`/api/gigs/${gigId}/cancel`, { reason });
}

/**
 * Preview cancellation (what happens if I cancel?)
 */
export async function getCancellationPreview(gigId: string): Promise<{
  zone: number;
  zone_label: string;
  fee: number;
  fee_pct: number;
  in_grace: boolean;
  policy: string;
  policy_label: string;
  policy_description: string;
  can_reschedule: boolean;
}> {
  return get(`/api/gigs/${gigId}/cancellation-preview`);
}

/**
 * Get available cancellation policy options (for gig creation form)
 */
export async function getCancellationPolicies(): Promise<{
  policies: Array<{ value: string; label: string; description: string }>;
}> {
  return get('/api/gigs/cancellation-policies');
}

/**
 * Get current user's posted gigs
 */
export async function getMyGigs(filters?: {
  status?: string[];
  page?: number;
  limit?: number;
}): Promise<{ gigs: GigListItem[]; total: number }> {
  const response = await get<{ gigs: GigListItem[]; total: number }>('/api/gigs/my-gigs', filters);
  return {
    ...response,
    gigs: normalizeGigSummaries((response as Record<string, unknown>).gigs as GigRecord[]) as unknown as GigListItem[],
  };
}

/**
 * Get current user's bids
 */
export async function getMyBids(filters?: {
  status?: string[];
  page?: number;
  limit?: number;
}): Promise<{ bids: (GigBid & { gig: Gig })[] }> {
  return get<{ bids: (GigBid & { gig: Gig })[] }>('/api/gigs/my-bids', filters);
}

/**
 * Get current user's bid for a specific gig
 */
export async function getMyBidForGig(gigId: string): Promise<{ bid: GigBid | null }> {
  return get<{ bid: GigBid | null }>(`/api/gigs/${gigId}/my-bid`);
}

/**
 * Get offers/bids received on gigs I posted
 */
export async function getReceivedOffers(filters?: {
  status?: string[];
  limit?: number;
}, config?: ApiRequestConfig): Promise<{ offers: any[]; total: number }> {
  return get('/api/gigs/received-offers', filters, config);
}

/**
 * Get gigs near a location
 */
export async function getNearbyGigs(params: {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers
  limit?: number;
}): Promise<{ gigs: GigWithDetails[] }> {
  const response = await get<{ gigs: GigWithDetails[] }>('/api/gigs/nearby', params);
  return {
    ...response,
    gigs: normalizeGigResponseList((response as Record<string, unknown>).gigs as GigRecord[]),
  };
}

/**
 * Get gig pins for a map viewport (privacy-safe approx_location)
 */
export async function getGigsInBounds(params: {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  status?: string; // default 'open'
  includeRemote?: boolean; // default true — include remote gigs in side list
  category?: string;
  limit?: number;
}): Promise<{
  gigs: Array<{
    id: string;
    title: string;
    description?: string;
    price: number | null;
    category: string | null;
    status: string;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    user_id: string;
    poster_display_name?: string | null;
    poster_username?: string | null;
    poster_profile_picture_url?: string | null;
    poster_account_type?: string | null;
    // Enriched fields from v2 RPC
    exact_city?: string | null;
    exact_state?: string | null;
    location_precision?: string | null;
    visibility_scope?: string | null;
    is_urgent?: boolean;
    tags?: string[];
    items?: unknown[];
    scheduled_start?: string | null;
    attachments?: string[];
    is_remote?: boolean;
  }>;
  nearest_activity_center?: { latitude: number; longitude: number } | null;
}> {
  const response = await get('/api/gigs/in-bounds', buildGigInBoundsParams(params));
  return {
    ...(response as Record<string, unknown>),
    gigs: normalizeGigSummaries(((response as Record<string, unknown>).gigs || []) as GigRecord[]) as unknown as Array<{
      id: string;
      title: string;
      description?: string;
      price: number | null;
      category: string | null;
      status: string;
      latitude: number | null;
      longitude: number | null;
      created_at: string;
      user_id: string;
      poster_display_name?: string | null;
      poster_username?: string | null;
      poster_profile_picture_url?: string | null;
      poster_account_type?: string | null;
      exact_city?: string | null;
      exact_state?: string | null;
      location_precision?: string | null;
      visibility_scope?: string | null;
      is_urgent?: boolean;
      tags?: string[];
      items?: unknown[];
      scheduled_start?: string | null;
      attachments?: string[];
      is_remote?: boolean;
    }>,
  } as {
    gigs: Array<{
      id: string;
      title: string;
      description?: string;
      price: number | null;
      category: string | null;
      status: string;
      latitude: number | null;
      longitude: number | null;
      created_at: string;
      user_id: string;
      poster_display_name?: string | null;
      poster_username?: string | null;
      poster_profile_picture_url?: string | null;
      poster_account_type?: string | null;
      exact_city?: string | null;
      exact_state?: string | null;
      location_precision?: string | null;
      visibility_scope?: string | null;
      is_urgent?: boolean;
      tags?: string[];
      items?: unknown[];
      scheduled_start?: string | null;
      attachments?: string[];
      is_remote?: boolean;
    }>;
  };
}

/**
 * Autocomplete suggestions for search
 */
export async function autocompleteGigs(
  q: string,
  limit = 5
): Promise<{
  titles: string[];
  categories: string[];
}> {
  return get<{ titles: string[]; categories: string[] }>('/api/gigs/autocomplete', { q, limit });
}

/**
 * Search gigs by keyword
 */
export async function searchGigs(
  query: string,
  filters?: GigFilters
): Promise<{
  gigs: GigWithDetails[];
  total: number;
}> {
  const response = await get<{ gigs: GigWithDetails[]; total: number }>('/api/gigs/search', {
    q: query,
    ...filters,
  });
  return {
    ...response,
    gigs: normalizeGigResponseList((response as Record<string, unknown>).gigs as GigRecord[]),
  };
}

/**
 * Get recommended gigs for user
 */
export async function getRecommendedGigs(limit?: number): Promise<{
  gigs: GigWithDetails[];
}> {
  const response = await get<{ gigs: GigWithDetails[] }>('/api/gigs/recommended', { limit });
  return {
    ...response,
    gigs: normalizeGigResponseList((response as Record<string, unknown>).gigs as GigRecord[]),
  };
}

/**
 * Report a gig
 */
export async function reportGig(
  gigId: string,
  reason: string,
  details?: string
): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/gigs/${gigId}/report`, { reason, details });
}

/**
 * Save/bookmark a gig
 */
export async function saveGig(gigId: string): Promise<ApiResponse> {
  return post<ApiResponse>(`/api/gigs/${gigId}/save`);
}

/**
 * Unsave/unbookmark a gig
 */
export async function unsaveGig(gigId: string): Promise<ApiResponse> {
  return del<ApiResponse>(`/api/gigs/${gigId}/save`);
}

/**
 * Get saved gigs
 */
export async function getSavedGigs(): Promise<{ gigs: GigWithDetails[] }> {
  const response = await get<{ gigs: GigWithDetails[] }>('/api/gigs/saved');
  return {
    ...response,
    gigs: normalizeGigResponseList((response as Record<string, unknown>).gigs as GigRecord[]),
  };
}

// ─── No-Show Handling ───

export interface NoShowCheckResult {
  can_report: boolean;
  reason: string;
  expected_start?: string;
  can_report_after?: string;
  minutes_overdue?: number;
  hours_since_accept?: number;
}

export interface NoShowReportResult {
  incident: any;
  gig: any;
  fee: number;
  message: string;
}

export interface GigStartReminderResult {
  success: boolean;
  sent_at: string;
  message: string;
  next_allowed_at?: string;
}

/**
 * Check if a no-show report is possible for this gig
 */
export async function checkNoShow(gigId: string): Promise<NoShowCheckResult> {
  return get<NoShowCheckResult>(`/api/gigs/${gigId}/no-show-check`);
}

/**
 * Report a no-show
 */
export async function reportNoShow(
  gigId: string,
  data?: { description?: string; evidence_urls?: string[] }
): Promise<NoShowReportResult> {
  return post<NoShowReportResult>(`/api/gigs/${gigId}/report-no-show`, data || {});
}

/**
 * Remind the assigned worker to start work.
 */
export async function remindWorker(gigId: string): Promise<GigStartReminderResult> {
  return post<GigStartReminderResult>(`/api/gigs/${gigId}/remind-worker`);
}

// ─── Worker Acknowledgement ───

export interface WorkerAckResult {
  success: boolean;
  worker_ack_status: string;
  worker_ack_updated_at: string;
  message: string;
}

/**
 * Worker acknowledges the assignment: "starting_now" or "running_late".
 */
export async function workerAck(
  gigId: string,
  data: { status: 'starting_now' | 'running_late'; eta_minutes?: number; note?: string },
): Promise<WorkerAckResult> {
  return post<WorkerAckResult>(`/api/gigs/${gigId}/worker-ack`, data);
}

/**
 * Worker self-releases from the assignment ("can't make it").
 */
export async function workerRelease(
  gigId: string,
  data?: { note?: string },
): Promise<{ success: boolean; message: string }> {
  return post<{ success: boolean; message: string }>(`/api/gigs/${gigId}/worker-release`, data || {});
}

// ─── Reliability ───

export interface ReliabilityStats {
  user_id: string;
  reliability_score: number;
  completion_rate: number;
  no_show_count: number;
  late_cancel_count: number;
  gigs_completed: number;
  gigs_posted: number;
  average_rating: number;
  review_count: number;
  badge: 'gold' | 'silver' | 'bronze' | null;
  badge_label: string | null;
}

/**
 * Get reliability stats for a user
 */
export async function getReliability(userId: string): Promise<ReliabilityStats> {
  return get<ReliabilityStats>(`/api/gigs/reliability/${userId}`);
}

// ─── Gig Timeline ───

export interface GigTimelineStep {
  key: string;
  label: string;
  completed: boolean;
  current: boolean;
  timestamp: string | null;
}

export interface GigTimelineData {
  gig_id: string;
  status: string;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  steps: GigTimelineStep[];
}

/**
 * Get computed timeline steps for a gig
 */
export async function getGigTimeline(gigId: string): Promise<GigTimelineData> {
  return get<GigTimelineData>(`/api/gigs/${gigId}/timeline`);
}

// ─── Structured Q&A ───

export interface GigQuestion {
  id: string;
  gig_id: string;
  question: string;
  question_attachments?: string[];
  answer?: string | null;
  answer_attachments?: string[];
  answered_at?: string | null;
  is_pinned: boolean;
  upvote_count: number;
  status: 'open' | 'answered';
  created_at: string;
  updated_at: string;
  asker?: {
    id: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    profile_picture_url?: string;
  };
  answerer?: { id: string; username?: string; name?: string } | null;
  answerer_display_name?: string | null;
  answerer_display_id?: string | null;
  answerer_display_username?: string | null;
}

/**
 * Get questions for a gig (public)
 */
export async function getGigQuestions(gigId: string): Promise<{ questions: GigQuestion[] }> {
  return get<{ questions: GigQuestion[] }>(`/api/gigs/${gigId}/questions`);
}

/**
 * Ask a question on a gig
 */
export async function askGigQuestion(
  gigId: string,
  question: string,
  attachments: string[] = []
): Promise<{ question: GigQuestion }> {
  return post<{ question: GigQuestion }>(`/api/gigs/${gigId}/questions`, { question, attachments });
}

/**
 * Answer a question (poster only)
 */
export async function answerGigQuestion(
  gigId: string,
  questionId: string,
  answer: string,
  attachments: string[] = []
): Promise<{ question: GigQuestion }> {
  return post<{ question: GigQuestion }>(`/api/gigs/${gigId}/questions/${questionId}/answer`, {
    answer,
    attachments,
  });
}

/**
 * Toggle pin on a question (poster only)
 */
export async function togglePinQuestion(
  gigId: string,
  questionId: string
): Promise<{ question: GigQuestion }> {
  return post<{ question: GigQuestion }>(`/api/gigs/${gigId}/questions/${questionId}/pin`);
}

/**
 * Toggle upvote on a question
 */
export async function toggleUpvoteQuestion(
  gigId: string,
  questionId: string
): Promise<{ upvoted: boolean }> {
  return post<{ upvoted: boolean }>(`/api/gigs/${gigId}/questions/${questionId}/upvote`);
}

/**
 * Delete a question
 */
export async function deleteGigQuestion(
  gigId: string,
  questionId: string
): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/api/gigs/${gigId}/questions/${questionId}`);
}

// ─── Change Orders ───

export interface ChangeOrder {
  id: string;
  gig_id: string;
  requested_by: string;
  type:
    | 'price_increase'
    | 'price_decrease'
    | 'scope_addition'
    | 'scope_reduction'
    | 'timeline_extension'
    | 'other';
  description: string;
  amount_change: number;
  time_change_minutes: number;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  requester?: { id: string; username?: string; name?: string };
  reviewer?: { id: string; username?: string; name?: string } | null;
}

/**
 * Get change orders for a gig
 */
export async function getChangeOrders(gigId: string): Promise<{ change_orders: ChangeOrder[] }> {
  return get<{ change_orders: ChangeOrder[] }>(`/api/gigs/${gigId}/change-orders`);
}

/**
 * Request a change order
 */
export async function createChangeOrder(
  gigId: string,
  data: { type: string; description: string; amount_change?: number; time_change_minutes?: number }
): Promise<{ change_order: ChangeOrder }> {
  return post<{ change_order: ChangeOrder }>(`/api/gigs/${gigId}/change-orders`, data);
}

/**
 * Approve a change order
 */
export async function approveChangeOrder(
  gigId: string,
  orderId: string
): Promise<{ change_order: ChangeOrder }> {
  return post<{ change_order: ChangeOrder }>(`/api/gigs/${gigId}/change-orders/${orderId}/approve`);
}

/**
 * Reject a change order
 */
export async function rejectChangeOrder(
  gigId: string,
  orderId: string,
  reason?: string
): Promise<{ change_order: ChangeOrder }> {
  return post<{ change_order: ChangeOrder }>(`/api/gigs/${gigId}/change-orders/${orderId}/reject`, {
    reason,
  });
}

/**
 * Withdraw a change order
 */
export async function withdrawChangeOrder(
  gigId: string,
  orderId: string
): Promise<{ change_order: ChangeOrder }> {
  return post<{ change_order: ChangeOrder }>(
    `/api/gigs/${gigId}/change-orders/${orderId}/withdraw`
  );
}

// ─── Gigs MVP v2 Endpoints ───

/**
 * Instant-accept a gig (helper action, engagement_mode must be 'instant_accept')
 */
export interface InstantAcceptResponse {
  gig: Gig;
  message: string;
  paymentRequired?: boolean;
  requiresPaymentSetup?: boolean;
  isSetupIntent?: boolean;
  payment?: {
    clientSecret?: string | null;
    paymentId?: string | null;
    setupIntentId?: string | null;
    paymentIntentId?: string | null;
  } | null;
}

export async function instantAccept(gigId: string): Promise<InstantAcceptResponse> {
  return post<InstantAcceptResponse>(`/api/gigs/${gigId}/instant-accept`);
}

/**
 * Get scored offers for a gig (v2 endpoint with trust capsules)
 * Falls back to getGigBids if v2 endpoint is unavailable
 */
export async function getGigOffersV2(gigId: string): Promise<{ offers: any[] }> {
  return get<{ offers: any[] }>(`/api/v2/gigs/${gigId}/offers`);
}

/**
 * Generate a shareable status link for a gig
 */
export async function shareGigStatus(
  gigId: string
): Promise<{ share_url: string; expires_at: string }> {
  return post<{ share_url: string; expires_at: string }>(`/api/gigs/${gigId}/share-status`);
}

/**
 * Update helper location for ETA tracking
 */
export async function updateHelperLocation(
  gigId: string,
  data: {
    latitude: number;
    longitude: number;
  }
): Promise<{ eta_minutes: number | null; distance_km: number | null }> {
  return post<{ eta_minutes: number | null; distance_km: number | null }>(
    `/api/gigs/${gigId}/update-location`,
    data
  );
}

/**
 * Get pre-sectioned browse feed data.
 * Returns curated sections: best_matches, urgent, clusters, high_paying, new_today, quick_jobs.
 */
export async function getBrowseSections(params: {
  lat: number;
  lng: number;
  radius?: number;
  task_archetype?: string;
}): Promise<BrowseResponse> {
  return get<BrowseResponse>('/api/gigs/browse', params);
}

// ── Dismiss / Hide ──────────────────────────────────────────

/**
 * Dismiss a gig ("Not Interested").
 */
export async function dismissGig(gigId: string, reason?: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/api/gigs/${gigId}/dismiss`, { reason });
}

/**
 * Undo a gig dismissal.
 */
export async function undismissGig(gigId: string): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/api/gigs/${gigId}/dismiss`);
}

/**
 * Get hidden categories for the current user.
 */
export async function getHiddenCategories(): Promise<{ categories: string[] }> {
  return get<{ categories: string[] }>('/api/gigs/hidden-categories');
}

/**
 * Hide a category from all results.
 */
export async function hideCategory(category: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>('/api/gigs/hidden-categories', { category });
}

/**
 * Unhide a category.
 */
export async function unhideCategory(category: string): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/api/gigs/hidden-categories/${encodeURIComponent(category)}`);
}

// ── Urgent task status lifecycle ──

export type UrgentFulfillmentStatus = 'on_the_way' | 'arrived' | 'picked_up' | 'dropped_off' | 'in_progress';

/**
 * Update the fulfillment status of an urgent task.
 */
export async function updateUrgentStatus(
  gigId: string,
  data: {
    status: UrgentFulfillmentStatus;
    helper_eta_minutes?: number | null;
    helper_latitude?: number;
    helper_longitude?: number;
  }
): Promise<{ gig: any; fulfillment_status: string }> {
  return post<{ gig: any; fulfillment_status: string }>(`/api/gigs/${gigId}/status`, data);
}

/**
 * Get the active status of an urgent task (fulfillment status, ETA, helper location).
 */
export async function getActiveStatus(
  gigId: string
): Promise<{
  gigId: string;
  gig_status: string;
  fulfillment_status: string | null;
  fulfillment_status_updated_at: string | null;
  helper_eta_minutes: number | null;
  helper_location: { latitude: number; longitude: number; updated_at: string } | null;
}> {
  return get<any>(`/api/gigs/${gigId}/active-status`);
}

// ── Price Benchmark ─────────────────────────────────────────

export interface PriceBenchmark {
  low: number;
  median: number;
  high: number;
  basis: string;
  comparable_count: number;
  category: string;
}

/**
 * Get price benchmark data for a category, optionally scoped by location.
 */
export async function getGigPriceBenchmark(
  category: string,
  lat?: number,
  lng?: number,
): Promise<{ benchmark: PriceBenchmark | null }> {
  const params: Record<string, unknown> = { category };
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  return get<{ benchmark: PriceBenchmark | null }>('/api/gigs/price-benchmark', params);
}

// ── Rebookable Gigs ─────────────────────────────────────────

export interface RebookableGig {
  id: string;
  title: string;
  category: string;
  price: number;
  completedAt: string;
  worker: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string;
    avatarUrl: string | null;
    rating: number;
  };
  myReview: { rating: number; comment: string | null } | null;
  city: string | null;
  state: string | null;
}

/**
 * Get gigs that the current user can rebook (completed gigs with known workers).
 */
export async function getRebookableGigs(): Promise<{ rebookable: RebookableGig[] }> {
  return get<{ rebookable: RebookableGig[] }>('/api/gigs/rebookable');
}
