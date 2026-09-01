// ============================================================
// PROFESSIONAL PROFILE ENDPOINTS
// Professional = User mode (not separate entity)
// ============================================================

import { get, post, patch, del } from '../client';

// ============ TYPES ============

export type ProfessionalCategory =
  | 'handyman' | 'plumber' | 'electrician' | 'landscaping' | 'cleaning'
  | 'painting' | 'moving' | 'pet_care' | 'tutoring' | 'photography'
  | 'catering' | 'personal_training' | 'auto_repair' | 'carpentry'
  | 'roofing' | 'hvac' | 'pest_control' | 'appliance_repair'
  | 'interior_design' | 'event_planning' | 'music_lessons'
  | 'web_development' | 'graphic_design' | 'writing' | 'consulting'
  | 'childcare' | 'elder_care' | 'delivery' | 'errand_running' | 'other';

export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface ServiceArea {
  city?: string;
  state?: string;
  radius_km?: number;
  latitude?: number;
  longitude?: number;
}

export interface PricingMeta {
  hourly_rate?: number;
  flat_rate?: number;
  currency?: string;
  pricing_note?: string;
}

export interface ProfessionalProfile {
  id: string;
  user_id: string;
  headline?: string;
  bio?: string;
  categories: ProfessionalCategory[];
  service_area?: ServiceArea;
  pricing_meta?: PricingMeta;
  is_public: boolean;
  is_active: boolean;
  verification_tier: number;
  verification_status: VerificationStatus;
  verification_submitted_at?: string;
  verification_completed_at?: string;
  boost_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalPublicProfile {
  user: {
    id: string;
    username: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    profile_picture_url?: string;
    city?: string;
    state?: string;
  };
  professional: {
    headline?: string;
    bio?: string;
    categories: ProfessionalCategory[];
    service_area?: ServiceArea;
    pricing_meta?: PricingMeta;
    verification_tier: number;
    verification_status: VerificationStatus;
    boost_multiplier: number;
  };
  portfolio: any[];
  skills: string[];
  review_stats: {
    count: number;
    average: number;
  };
}

export interface CreateProfileData {
  headline?: string;
  bio?: string;
  categories?: (ProfessionalCategory | string)[];
  service_area?: ServiceArea;
  pricing_meta?: PricingMeta;
  is_public?: boolean;
}

export interface UpdateProfileData extends Partial<CreateProfileData> {
  is_active?: boolean;
}

// ============ ENDPOINTS ============

/**
 * Enable professional mode / create professional profile
 */
export async function createProfile(data: CreateProfileData): Promise<{
  message: string;
  profile: ProfessionalProfile;
}> {
  return post('/api/professional/profile', data);
}

/**
 * Get my professional profile
 */
export async function getMyProfile(): Promise<{ profile: ProfessionalProfile | null }> {
  return get('/api/professional/profile/me');
}

/**
 * Update my professional profile
 */
export async function updateMyProfile(data: UpdateProfileData): Promise<{
  message: string;
  profile: ProfessionalProfile;
}> {
  return patch('/api/professional/profile/me', data);
}

/**
 * Disable professional mode (soft delete)
 */
export async function disableProfile(): Promise<{
  message: string;
  profile: ProfessionalProfile;
}> {
  return del('/api/professional/profile/me');
}

/**
 * Get public professional profile by username
 */
export async function getPublicProfile(username: string): Promise<ProfessionalPublicProfile> {
  return get(`/api/professional/${username}`);
}

/**
 * Discover professionals
 */
export async function discoverProfessionals(params?: {
  category?: ProfessionalCategory;
  city?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<{ professionals: (ProfessionalProfile & { user: any })[] }> {
  return get('/api/professional/discover', params);
}

/**
 * Start verification process
 */
export async function startVerification(tier: 1 | 2 = 1): Promise<{
  message: string;
  verification_status: VerificationStatus;
}> {
  return post('/api/professional/verification/start', { tier });
}

/**
 * Check verification status
 */
export async function getVerificationStatus(): Promise<{
  tier: number;
  status: VerificationStatus;
  submitted_at?: string;
  completed_at?: string;
}> {
  return get('/api/professional/verification/status');
}
