// ============================================================
// BUSINESS TYPES
// Based on backend/database/schema.sql tables:
// User (account_type=business), BusinessProfile, BusinessLocation,
// BusinessHours, BusinessCatalogItem, BusinessPage, BusinessTeam
// ============================================================

// ─── BusinessUser ───────────────────────────────────────────

export interface BusinessUser {
  id: string;
  username: string;
  name: string;
  email: string;
  account_type: 'business';
  profile_picture_url?: string | null;
  cover_photo_url?: string | null;
  bio?: string | null;
  tagline?: string | null;
  average_rating?: number | null;
  review_count?: number;
  profile?: BusinessProfile | null;
}

// ─── BusinessProfile ────────────────────────────────────────

import type { EntityType } from './entityTypes';

export interface BusinessProfile {
  business_user_id: string;
  business_type: EntityType | string;
  categories: string[];
  description?: string | null;
  logo_file_id?: string | null;
  banner_file_id?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  website?: string | null;
  social_links?: Record<string, string>;
  primary_location_id?: string | null;
  founded_year?: number | null;
  employee_count?: string | null;
  service_area?: Record<string, unknown>;
  is_published: boolean;
  published_at?: string | null;
  theme?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  verification_status?: string;
  verification_tier?: string;
  verified_at?: string | null;
  profile_completeness?: number;
  avg_response_minutes?: number | null;
  active_from?: string | null;
  active_until?: string | null;
}

// ─── BusinessHours ──────────────────────────────────────────

export interface BusinessHours {
  id: string;
  location_id: string;
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed: boolean;
  notes?: string | null;
}

export interface BusinessSpecialHours {
  id: string;
  location_id: string;
  date: string;
  label?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  is_closed: boolean;
  notes?: string | null;
}

// ─── CatalogCategory ───────────────────────────────────────

export interface CatalogCategory {
  id: string;
  business_user_id: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  sort_order: number;
  is_active: boolean;
}

// ─── CatalogItem ────────────────────────────────────────────

export type CatalogItemKind =
  | 'service' | 'product' | 'menu_item' | 'class'
  | 'rental' | 'membership' | 'donation' | 'event' | 'other';

export type CatalogItemStatus = 'active' | 'draft' | 'archived';

export interface CatalogItem {
  id: string;
  business_user_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  kind: CatalogItemKind;
  price_cents?: number | null;
  price_max_cents?: number | null;
  price_unit?: string | null;
  currency: string;
  duration_minutes?: number | null;
  image_file_id?: string | null;
  image_url?: string | null;
  gallery_file_ids?: string[];
  status: CatalogItemStatus;
  is_featured?: boolean;
  available_at_location_ids?: string[];
  suggested_amounts?: number[] | null;
  tax_deductible?: boolean;
  suggested_description?: string | null;
  tags: string[];
  details?: Record<string, unknown>;
  sort_order: number;
  category?: { id: string; name: string; slug?: string };
}

// ─── BusinessPage ───────────────────────────────────────────

export interface BusinessPage {
  id: string;
  business_user_id: string;
  slug: string;
  title: string;
  description?: string | null;
  is_default: boolean;
  show_in_nav: boolean;
  nav_order: number;
  icon_key?: string | null;
  draft_revision: number;
  published_revision: number;
  published_at?: string | null;
  seo?: Record<string, unknown>;
  theme?: Record<string, unknown>;
}

export interface PageBlock {
  id: string;
  page_id: string;
  revision: number;
  block_type: string;
  schema_version: number;
  sort_order: number;
  data: Record<string, unknown>;
  settings?: Record<string, unknown>;
  location_id?: string | null;
  show_from?: string | null;
  show_until?: string | null;
  is_visible: boolean;
}

// ─── BusinessTeamMember ─────────────────────────────────────

export type BusinessRoleBase = 'owner' | 'admin' | 'editor' | 'viewer';

export interface BusinessTeamMember {
  id: string;
  business_user_id: string;
  user_id: string;
  role_base: BusinessRoleBase;
  title?: string | null;
  is_active: boolean;
  invited_by?: string | null;
  invited_at?: string | null;
  joined_at?: string | null;
  left_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // User fields from join
  user?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string | null;
    email?: string;
  };
}

// ─── BusinessMembership (my-businesses response) ────────────

export interface BusinessMembership {
  id: string;
  role_base: string;
  title?: string | null;
  joined_at: string;
  business_user_id: string;
  business?: BusinessUser;
  profile?: BusinessProfile | null;
}

// ─── BusinessReview ─────────────────────────────────────────

export interface BusinessReview {
  id: string;
  gig_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string | null;
  media_urls?: string[];
  owner_response?: string | null;
  owner_responded_at?: string | null;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
  reviewer?: {
    id: string;
    username: string;
    name?: string;
    first_name?: string;
    profile_picture_url?: string | null;
  };
  gig_title?: string;
}

// ─── BusinessReviewsSummary ─────────────────────────────────

export interface BusinessReviewsSummary {
  total: number;
  average_rating: number;
  distribution?: Record<number, number>;
}

// ─── BusinessInsights ───────────────────────────────────────

export interface BusinessInsights {
  period: string;
  days: number;
  views: {
    total: number;
    trend: number;
    by_day: Array<{ date: string; count: number }>;
    by_source: Array<{ source: string; count: number }>;
  };
  followers: {
    total: number;
    new: number;
    trend: number;
  };
  reviews: {
    count: number;
    trend: number;
    average_rating: number;
  };
}

// ─── BusinessDashboard (aggregate response) ─────────────────

export interface BusinessDashboard {
  business: BusinessUser;
  profile: BusinessProfile;
  locations: Array<{
    id: string;
    business_user_id: string;
    label: string;
    is_primary: boolean;
    address: string;
    city: string;
    state?: string;
    zipcode?: string;
    country: string;
    is_active: boolean;
  }>;
  team: BusinessTeamMember[];
  catalog: CatalogItem[];
  pages: BusinessPage[];
  access: { hasAccess: boolean; isOwner: boolean; role_base: string | null };
}

// ─── PageRevision ───────────────────────────────────────────

export interface PageRevision {
  id: string;
  page_id: string;
  revision: number;
  published_at: string;
  notes?: string | null;
  publisher?: {
    id: string;
    username: string;
    name: string;
    profile_picture_url?: string | null;
  };
}
