// ============================================================
// GIG-RELATED TYPES
// Based on backend/database/schema.sql tables:
// Gig, GigBid, Assignment, Review, GigChangeOrder, GigQuestion
// ============================================================

import type { PaymentStatus } from './index';

// ─── Status unions ───────────────────────────────────────────

export type GigStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'pending_undo';

export type GigBidStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'expired'
  | 'countered';

export type CounterStatus = 'pending' | 'accepted' | 'declined' | null;

export type AssignmentStatus = 'accepted' | 'completed' | 'cancelled';

export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export type ChangeOrderType =
  | 'price_increase'
  | 'price_decrease'
  | 'scope_addition'
  | 'scope_reduction'
  | 'timeline_extension'
  | 'other';

export type LocationPrecision = 'exact_place' | 'approx_area' | 'neighborhood_only' | 'none';

export type RevealPolicy = 'public' | 'after_interest' | 'after_assignment' | 'never_public';

export type VisibilityScope = 'neighborhood' | 'city' | 'radius' | 'global';

export type GigOriginMode = 'home' | 'address' | 'current';

export type GigSourceType = 'listing' | 'post' | 'event';

// ─── Gig ─────────────────────────────────────────────────────

export interface Gig {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category?: string | null;
  deadline?: string | null;
  estimated_duration?: number | null;
  attachments?: string[];
  status: GigStatus;

  // Location
  location?: { latitude: number; longitude: number } | null;
  exact_address?: string | null;
  exact_city?: string | null;
  exact_state?: string | null;
  exact_zip?: string | null;
  location_precision?: LocationPrecision;
  reveal_policy?: RevealPolicy;
  visibility_scope?: VisibilityScope;
  radius_miles?: number;
  /** Whether the viewer has access to the exact location (owner or accepted worker) */
  locationUnlocked?: boolean;

  // Origin
  origin_mode?: GigOriginMode | null;
  origin_home_id?: string | null;
  origin_user_place_id?: string | null;
  origin_place_id?: string | null;

  // Assignment
  accepted_by?: string | null;
  accepted_at?: string | null;

  // Workflow timestamps
  started_at?: string | null;
  worker_completed_at?: string | null;
  owner_confirmed_at?: string | null;
  scheduled_start?: string | null;

  // Assignment coordination
  last_worker_reminder_at?: string | null;
  worker_ack_status?: 'starting_now' | 'running_late' | 'cant_make_it' | null;
  worker_ack_eta_minutes?: number | null;
  worker_ack_note?: string | null;
  worker_ack_updated_at?: string | null;
  auto_reminder_count?: number | null;

  // Cancellation
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  cancellation_policy?: string;
  cancellation_zone?: number | null;
  cancellation_fee?: number | null;

  // Completion
  completion_note?: string | null;
  completion_photos?: string[];
  completion_checklist?: Array<{ item: string; done: boolean }>;
  owner_confirmation_note?: string | null;
  owner_satisfaction?: number | null;

  // Payment
  payment_id?: string | null;
  payment_status?: PaymentStatus | string;

  // Flags & metadata
  is_urgent?: boolean;
  tags?: string[];
  items?: unknown[];
  viewer_has_saved?: boolean;
  created_by?: string | null;
  beneficiary_user_id?: string | null;
  ref_listing_id?: string | null;
  ref_post_id?: string | null;
  source_type?: GigSourceType | null;
  source_id?: string | null;
  estimated_dur?: number | null;

  // Archetype & workflow
  task_archetype?: string | null;
  starts_asap?: boolean;
  response_window_minutes?: number | null;
  schedule_type?: string | null;
  pay_type?: string | null;
  engagement_mode?: string | null;
  source_flow?: string | null;

  // Delivery
  pickup_address?: string | null;
  dropoff_address?: string | null;
  delivery_proof_required?: boolean;

  // Pro service
  requires_license?: boolean;
  requires_insurance?: boolean;
  deposit_required?: boolean;
  deposit_amount?: number | null;
  scope_description?: string | null;

  // Power fields
  special_instructions?: string | null;
  access_notes?: string | null;
  required_tools?: string[];

  // Module JSONB columns
  care_details?: Record<string, unknown> | null;
  logistics_details?: Record<string, unknown> | null;
  remote_details?: Record<string, unknown> | null;
  urgent_details?: Record<string, unknown> | null;
  event_details?: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
}

// ─── API response shapes ─────────────────────────────────────

/** Compact user object nested in API responses. */
export type GigUserSummary = {
  id: string;
  /** Canonical local identity handle. Prefer this over username. */
  handle?: string | null;
  /** Canonical display name. Prefer this over legacy name fields. */
  displayName?: string | null;
  /** Canonical avatar URL. Prefer this over profile_picture_url. */
  avatarUrl?: string | null;
  userId?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  username?: string;
  name?: string;
  profile_picture_url?: string | null;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  account_type?: string;
  average_rating?: number;
  review_count?: number;
  reliability_score?: number;
  no_show_count?: number;
  gigs_completed?: number;
  middle_name?: string;
};

/** Gig detail as returned by GET /api/gigs/:id */
export interface GigDetail extends Gig {
  creator?: GigUserSummary;
  acceptedBy?: GigUserSummary;
}

/** Gig list item as returned by GET /api/gigs */
export interface GigListItem extends Gig {
  poster_display_name?: string;
  poster_username?: string;
  poster_profile_picture_url?: string;
  poster_account_type?: string;
  bidsCount?: number;
  bid_count?: number;
  top_bid_amount?: number | null;
  /** Distance from the queried lat/lng in meters (spatial path only) */
  distance_meters?: number | null;
  /** Legacy/alternate distance field returned by some endpoints */
  distance_km?: number | null;
  /** Approximate latitude for map display (privacy-safe) */
  approx_latitude?: number | null;
  /** Approximate longitude for map display (privacy-safe) */
  approx_longitude?: number | null;
  /** Whether the viewer has access to the exact location */
  locationUnlocked?: boolean;
  /** First image attachment URL for thumbnail display */
  first_image?: string | null;
  /** Legacy budget field returned by some chat/list endpoints */
  budget?: number | null;
}

// ─── Bid ─────────────────────────────────────────────────────

export interface GigBid {
  id: string;
  gig_id: string;
  user_id: string;
  bid_amount: number;
  message?: string | null;
  proposed_time?: string | null;
  status: GigBidStatus;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;

  // Withdrawal
  withdrawal_reason?: string | null;
  withdrawn_at?: string | null;

  // Counter-offer
  counter_amount?: number | null;
  counter_message?: string | null;
  countered_at?: string | null;
  countered_by?: string | null;
  counter_status?: CounterStatus;
}

/** Bid as returned by GET /api/gigs/:gigId/bids (includes bidder) */
export interface GigBidWithUser extends GigBid {
  bidder?: GigUserSummary;
}

// ─── Assignment ──────────────────────────────────────────────

export interface Assignment {
  id: string;
  gig_id: string;
  user_id: string;
  current_status: AssignmentStatus;
  created_at: string;
  updated_at: string;
}

// ─── Review ──────────────────────────────────────────────────

export interface Review {
  id: string;
  gig_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number; // 1-5
  comment?: string | null;
  media_urls?: string[];
  owner_response?: string | null;
  owner_responded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithUser extends Review {
  reviewer?: GigUserSummary;
  reviewee?: GigUserSummary;
}

// ─── Change order ────────────────────────────────────────────

export interface GigChangeOrder {
  id: string;
  gig_id: string;
  requested_by: string;
  requester?: GigUserSummary;
  type: ChangeOrderType;
  description: string;
  amount_change?: number;
  time_change_minutes?: number;
  status: ChangeOrderStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Browse sections (GET /api/gigs/browse) ────────────────

/** Category cluster returned by the browse endpoint. */
export interface GigCluster {
  category: string;
  count: number;
  price_min: number;
  price_max: number;
  price_avg: number;
  nearest_distance: number;
  newest_at: string;
  representative_title: string;
}

/** De-duplicated stack of similar gigs. */
export interface GigStack {
  stack_id: string;
  representative_title: string;
  count: number;
  price_min: number;
  price_max: number;
  nearest_distance: number;
  newest_at: string;
  gig_ids: string[];
}

/** The six curated sections in the browse feed. */
export interface BrowseSections {
  best_matches: GigListItem[];
  urgent: GigListItem[];
  clusters: GigCluster[];
  high_paying: GigListItem[];
  new_today: GigListItem[];
  quick_jobs: GigListItem[];
}

/** Full response from GET /api/gigs/browse. */
export interface BrowseResponse {
  sections: BrowseSections;
  total_active: number;
  radius_used: number;
}

// ─── Question ────────────────────────────────────────────────

export type QuestionStatus = 'open' | 'answered';

export interface GigQuestion {
  id: string;
  gig_id: string;
  asked_by?: string;
  asker?: GigUserSummary;
  question: string;
  answer?: string | null;
  answered_by?: string | null;
  answerer?: GigUserSummary | null;
  asker_display_name?: string | null;
  answerer_display_name?: string | null;
  answered_at?: string | null;
  is_pinned?: boolean;
  upvote_count?: number;
  status: QuestionStatus;
  question_attachments?: string[];
  answer_attachments?: string[];
  created_at: string;
  updated_at: string;
}
