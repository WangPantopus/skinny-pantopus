// ============================================================
// REVIEW ENDPOINTS
// Create and fetch reviews for users and gigs
// ============================================================

import { get, post } from '../client';

/**
 * Create a review for a completed gig
 */
export async function createReview(data: {
  gig_id: string;
  reviewee_id: string;
  rating: number;
  comment?: string;
}): Promise<{
  review: {
    id: string;
    gig_id: string;
    reviewer_id: string;
    reviewee_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
  };
}> {
  return post('/api/reviews', data);
}

/**
 * Get reviews received by a user (for profile page)
 */
export async function getUserReviews(
  userId: string,
  params?: { page?: number; limit?: number }
): Promise<{
  reviews: Array<{
    id: string;
    gig_id: string;
    reviewer_id: string;
    reviewee_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer_name: string;
    reviewer_avatar: string | null;
    reviewer_username: string | null;
    received_as?: 'worker' | 'poster' | 'unknown';
    media_urls?: string[];
    gig?: {
      id: string;
      title?: string | null;
      user_id?: string | null;
      accepted_by?: string | null;
    } | null;
    reviewer?: {
      id: string;
      username: string;
      name: string;
      profile_picture_url: string | null;
    };
  }>;
  total: number;
  average_rating: number;
  counts?: {
    worker: number;
    poster: number;
    unknown: number;
  };
  page: number;
  limit: number;
}> {
  return get(`/api/reviews/user/${userId}`, params);
}

/**
 * Get reviews for a specific gig
 */
export async function getGigReviews(gigId: string): Promise<{
  reviews: Array<{
    id: string;
    reviewer_id: string;
    reviewee_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer_name: string;
    reviewer_avatar: string | null;
  }>;
}> {
  return get(`/api/reviews/gig/${gigId}`);
}

/**
 * Get completed gigs where the current user hasn't left a review yet
 */
export async function getPendingReviews(): Promise<{
  pending: Array<{
    gig_id: string;
    gig_title: string;
    reviewee_id: string;
    reviewee_name: string;
    reviewee_avatar: string | null;
    role: 'owner' | 'worker';
  }>;
}> {
  return get('/api/reviews/my-pending');
}
