// ============================================================
// LISTING (MARKETPLACE) TYPES
// Based on backend/database/schema.sql tables:
// Listing, ListingQuestion
// ============================================================

import type { User } from './index';

// ─── Status & enum unions ────────────────────────────────────
// IMPORTANT: These types must stay in sync with the canonical
// marketplace contract at @pantopus/ui-utils/marketplace-contract.ts.
// When adding or removing values, update BOTH files.

export type ListingStatus = 'draft' | 'active' | 'pending_pickup' | 'sold' | 'archived' | 'reserved' | 'traded';

export type ListingLayer = 'goods' | 'gigs' | 'rentals' | 'vehicles';

export type ListingType =
  | 'sell_item'
  | 'free_item'
  | 'wanted_request'
  | 'rent_sublet'
  | 'vehicle_sale'
  | 'vehicle_rent'
  | 'service_gig'
  | 'pre_order'
  | 'recurring'
  | 'trade_swap'
  | 'flash_sale';

export type ListingCategory =
  | 'furniture'
  | 'electronics'
  | 'clothing'
  | 'kids_baby'
  | 'tools'
  | 'home_garden'
  | 'sports_outdoors'
  | 'vehicles'
  | 'books_media'
  | 'collectibles'
  | 'appliances'
  | 'free_stuff'
  | 'food_baked_goods'
  | 'plants_garden'
  | 'pet_supplies'
  | 'arts_crafts'
  | 'tickets_events'
  | 'other';

export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';

export type ListingLocationPrecision = 'exact_place' | 'approx_area' | 'neighborhood_only' | 'none';

export type ListingRevealPolicy = 'public' | 'after_interest' | 'after_assignment' | 'never_public';

export type ListingVisibilityScope = 'neighborhood' | 'city' | 'radius' | 'global';

// ─── Listing ─────────────────────────────────────────────────

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  is_free?: boolean;
  category: ListingCategory | string;
  subcategory?: string | null;
  condition?: ListingCondition | null;
  quantity?: number;
  status: ListingStatus;

  // Media
  media_urls?: string[];
  media_types?: string[];

  // Location
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  location_address?: string | null;
  location_precision?: ListingLocationPrecision;
  reveal_policy?: ListingRevealPolicy;
  visibility_scope?: ListingVisibilityScope;
  radius_miles?: number | null;
  /** Whether the viewer has access to the exact location (owner or address grantee) */
  locationUnlocked?: boolean;

  // Marketplace
  layer: ListingLayer;
  listing_type: ListingType;
  home_id?: string | null;
  is_address_attached?: boolean;

  // Preferences
  meetup_preference?: string;
  delivery_available?: boolean;

  // Availability
  available_from?: string | null;
  available_until?: string | null;
  expires_at?: string | null;
  last_refreshed_at?: string | null;
  refresh_count?: number;

  // Engagement
  view_count?: number;
  save_count?: number;
  message_count?: number;

  // Tags & search
  tags?: string[];
  context_tags?: string[];

  // Scoring
  quality_score?: number;
  risk_score?: number;

  // Negotiable
  is_negotiable?: boolean;

  // Wanted listings
  is_wanted?: boolean;
  budget_max?: number | null;

  // Source linking
  source_type?: string | null;
  source_id?: string | null;

  // Offer tracking
  active_offer_count?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
  sold_at?: string | null;
  archived_at?: string | null;
}

/** Compact user object nested in listing API responses. */
// After P0.4 the backend returns the new identity shape; legacy fields are
// typed-optional so consumers can migrate to handle / displayName /
// avatarUrl incrementally.
export type ListingUserSummary = {
  id: string;
  /** P0.4 canonical handle. Prefer this over username. */
  handle?: string | null;
  /** P0.4 canonical display name. Prefer this over name/first_name. */
  displayName?: string;
  /** P0.4 canonical avatar URL. Prefer this over profile_picture_url. */
  avatarUrl?: string | null;
  /** Legacy. */
  username?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  city?: string;
  state?: string;
};

/** Listing detail as returned by GET /api/listings/:id */
export interface ListingDetail extends Listing {
  creator?: ListingUserSummary;
  userHasSaved?: boolean;
}

/** Listing list item as returned by GET /api/listings */
export interface ListingListItem extends Listing {
  creator?: ListingUserSummary;
  distance_meters?: number | null;
  userHasSaved?: boolean;
  /** First image URL from media_urls for thumbnail display */
  first_image?: string | null;
}

// ─── Marketplace Browse Redesign response types ─────────────

/** Bounding box coordinates */
export interface BoundsBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Response from GET /api/listings/browse */
export interface MarketplaceBrowseResponse {
  listings: ListingListItem[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
  meta: {
    total_in_bounds: number;
    free_count: number;
    bounds_used: BoundsBox;
    /** Set to true when search auto-expanded bounds due to zero results */
    expanded?: boolean;
  };
}

/** Category cluster for the "By Category" discovery section */
export interface ListingCategoryCluster {
  category: string;
  count: number;
  price_min: number | null;
  price_max: number | null;
  newest_at: string;
  representative_image?: string | null;
}

/** Response from GET /api/listings/discover */
export interface MarketplaceDiscoverResponse {
  sections: {
    free_nearby: ListingListItem[];
    just_listed: ListingListItem[];
    nearby_deals: ListingListItem[];
    by_category: ListingCategoryCluster[];
    wanted_nearby: ListingListItem[];
  };
  total_active: number;
  free_count: number;
}

/** Response from GET /api/listings/autocomplete */
export interface MarketplaceAutocompleteResponse {
  titles: string[];
  categories: string[];
}

// ─── Listing question ────────────────────────────────────────

export type ListingQuestionStatus = 'open' | 'answered';

export interface ListingQuestion {
  id: string;
  listing_id: string;
  asked_by: string;
  question: string;
  answer?: string | null;
  answered_by?: string | null;
  answered_at?: string | null;
  is_pinned?: boolean;
  upvote_count?: number;
  status: ListingQuestionStatus;
  question_attachments?: string[];
  answer_attachments?: string[];
  created_at: string;
  updated_at: string;
  /** Populated by the API when returning questions */
  asker?: ListingUserSummary;
}

// ─── Listing message (express interest) ──────────────────────

export interface ListingMessage {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id?: string;
  message?: string | null;
  offer_amount?: number | null;
  status?: string;
  created_at: string;
  updated_at?: string;
  buyer?: ListingUserSummary;
}
