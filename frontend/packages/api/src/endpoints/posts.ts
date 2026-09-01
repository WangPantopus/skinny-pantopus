// ============================================================
// POSTS / FEED ENDPOINTS
// Scoped feeds, posts, comments, likes, follows, hide/mute
// ============================================================

import { get, post, put, del, patch } from '../client';

// ============ TYPES — re-exported from @pantopus/types ============

export type {
  PostType, PostVisibility, PostFormat, LocationPrecision, VisibilityScope,
  SafetyAlertKind, FeedSurface, DistributionTarget, PostAs, PersonalPostAs, PersonaPostAudience, Audience,
  FeedScope, TrustLevel, MapLayerType, PostCreator, PostComment,
  PostingIdentity, Post, MatchedBusiness,
} from '@pantopus/types/post';

import type {
  Audience,
  DistributionTarget,
  FeedScope,
  FeedSurface,
  LocationPrecision,
  MapLayerType,
  MatchedBusiness,
  PersonaPostAudience,
  Post,
  PostAs,
  PostComment,
  PostFormat,
  PostingIdentity,
  PostType,
  PostVisibility,
  SafetyAlertKind,
  VisibilityScope,
} from '@pantopus/types/post';

export async function getMatchedBusinesses(
  postId: string,
  params?: { cached?: boolean },
): Promise<{ businesses: MatchedBusiness[]; cached: boolean; expired?: boolean }> {
  return get(`/api/posts/${postId}/matched-businesses`, params);
}

// ============ v1.1 CURSOR-PAGINATED FEEDS ============

export interface CursorPagination {
  nextCursor: { createdAt: string; id: string; rankBucket?: number } | null;
  hasMore: boolean;
}

export interface FeedResponseV2 {
  posts: Post[];
  pagination: CursorPagination;
  emptyGraph?: boolean;
  requiresViewingLocation?: boolean;
  message?: string;
  activeEventKey?: string | null;
  noActiveEvent?: boolean;
}

export type FeedTopic = 'sports';
export type SportsMode = 'for_you' | 'local' | 'event' | 'watch';

export async function getFeedV2(params: {
  surface: FeedSurface;
  limit?: number;
  cursorCreatedAt?: string;
  cursorId?: string;
  cursorRankBucket?: number;
  postType?: PostType;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
  tags?: string;
  topic?: FeedTopic;
  sportsMode?: SportsMode;
  eventKey?: string;
}): Promise<FeedResponseV2> {
  return get('/api/posts/feed', params);
}

// ============ SPORTS TOPIC LANE ============

export interface ActiveSportsEvent {
  event_key: string;
  display_name: string;
  short_label: string;
  league: string;
  country: string;
  starts_at: string;
  ends_at: string;
  priority: number;
  cadence?: Record<string, unknown>;
}

export interface ActiveSportsEventsResponse {
  primaryEvent: ActiveSportsEvent | null;
  events: ActiveSportsEvent[];
}

export async function getActiveSportsEvents(): Promise<ActiveSportsEventsResponse> {
  return get('/api/sports/active-events');
}

// ============ PLACE ELIGIBILITY ============

export interface PlaceEligibility {
  eligible: boolean;
  readOnly: boolean;
  reason?: string | null;
  trustLevel?: string;
}

export async function checkPlaceEligibility(params: {
  latitude: number;
  longitude: number;
  gpsTimestamp?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}): Promise<PlaceEligibility> {
  return get('/api/posts/place-eligibility', params);
}

// ============ POSTING IDENTITIES ============

export async function getPostingIdentities(): Promise<{ identities: PostingIdentity[] }> {
  return get('/api/posts/identities');
}

// ============ MAP ============

export interface MapMarker {
  layer_type: MapLayerType;
  id: string;
  latitude: number;
  longitude: number;
  // Post fields
  post_type?: PostType;
  post_as?: PostAs;
  audience?: Audience | PersonaPostAudience;
  content?: string;
  location_name?: string;
  home_address?: string;
  like_count?: number;
  comment_count?: number;
  userHasLiked?: boolean;
  userHasSaved?: boolean;
  created_at?: string;
  creator?: { id: string; username: string; name?: string; profile_picture_url?: string };
  // Task/Offer fields
  title?: string;
  description?: string;
  status?: string;
  category?: string;
  // Business fields
  business_name?: string;
  logo_url?: string;
  is_verified?: boolean;
  address?: string;
  // Home fields
  city?: string;
  state?: string;
  home_type?: string;
}

/** @deprecated Use getMapMarkers instead */
export interface MapPost {
  id: string;
  latitude: number;
  longitude: number;
  post_type: PostType;
  content: string;
  location_name?: string;
  home_address?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  creator: { id: string; username: string; name?: string; profile_picture_url?: string };
}

export async function getMapMarkers(params: {
  south: number;
  west: number;
  north: number;
  east: number;
  surface?: FeedSurface;
  postType?: PostType;
  limit?: number;
  layers?: string; // comma-separated: posts,tasks,offers,businesses,homes
}): Promise<{ markers: MapMarker[]; nearest_activity_center?: { latitude: number; longitude: number } | null }> {
  return get('/api/posts/map', params);
}

/** @deprecated Use getMapMarkers instead */
export async function getMapPosts(params: {
  south: number;
  west: number;
  north: number;
  east: number;
  surface?: FeedSurface;
  postType?: PostType;
  limit?: number;
}): Promise<{ posts: MapPost[] }> {
  const result = await getMapMarkers(params);
  return {
    posts: (result.markers || []).filter((marker) => marker.layer_type === 'post') as MapPost[],
  };
}

// ============ POSTS CRUD ============

export async function createPost(data: {
  content: string;
  title?: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  mediaThumbnails?: string[];
  mediaLiveUrls?: string[];
  postType?: PostType;
  postFormat?: PostFormat;
  visibility?: PostVisibility;
  locationPrecision?: LocationPrecision;
  visibilityScope?: VisibilityScope;
  homeId?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  radiusMiles?: number;
  tags?: string[];
  // Feed redesign fields
  postAs?: PostAs;
  identityContextId?: string;
  audience?: Audience;
  targetPlaceId?: string;
  businessId?: string;
  isStory?: boolean;
  // Event fields
  eventDate?: string;
  eventEndDate?: string;
  eventVenue?: string;
  // Safety alert fields
  safetyAlertKind?: SafetyAlertKind;
  safetyHappenedAt?: string;
  safetyHappenedEnd?: string;
  behaviorDescription?: string;
  // Deals fields
  dealExpiresAt?: string;
  businessName?: string;
  // Lost & found
  lostFoundType?: 'lost' | 'found';
  contactPref?: string;
  // Service offer
  serviceCategory?: string;
  // Cross-surface references
  refListingId?: string;
  refTaskId?: string;
  // v1.1: Distribution targets & cross-post
  distributionTargets?: DistributionTarget[];
  crossPostToConnections?: boolean;
  gpsTimestamp?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  // v1.2: Social layer fields
  purpose?: string;
  profileVisibilityScope?: 'public' | 'connections' | 'local_context' | 'hidden';
  showOnProfile?: boolean;
}): Promise<{ message: string; post: Post }> {
  return post('/api/posts', data);
}

export async function getPost(postId: string): Promise<{ post: Post }> {
  return get(`/api/posts/${postId}`);
}

export async function updatePost(postId: string, data: {
  content?: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  mediaThumbnails?: string[];
  postType?: PostType;
  visibility?: PostVisibility;
}): Promise<{ message: string; post: Post }> {
  return patch(`/api/posts/${postId}`, data);
}

export async function deletePost(postId: string): Promise<{ message: string }> {
  return del(`/api/posts/${postId}`);
}

// ============ HIDE / MUTE / RESOLVE ============

export async function hidePost(postId: string): Promise<{ message: string }> {
  return post(`/api/posts/hide/${postId}`);
}

export async function muteEntity(data: {
  entityType: 'user' | 'business';
  entityId: string;
}): Promise<{ message: string }> {
  return post('/api/posts/mute', data);
}

export async function unmuteEntity(params: {
  entityType: 'user' | 'business';
  entityId: string;
}): Promise<{ message: string }> {
  return del('/api/posts/mute', params);
}

export async function resolveQuestion(postId: string): Promise<{ message: string }> {
  return patch(`/api/posts/resolve/${postId}`);
}

export async function toggleGlobalPin(postId: string): Promise<{ message: string; post: any }> {
  return patch(`/api/posts/global-pin/${postId}`);
}

// ============ v1.2 SOCIAL LAYER ============

export interface PrecheckResult {
  ok: boolean;
  canPost: boolean;
  cooldown?: { restriction_level: string; expires_at: string; reason: string } | null;
  flags: Array<{ type: string; level?: string; message: string; suggestedAction?: string; expiresAt?: string }>;
  suggestions: Array<{ type: string; message: string; suggestedAction?: string; suggestedIntents?: string[] }>;
  isVisitor: boolean;
}

export async function precheckPost(data: {
  content: string;
  postType?: string;
  purpose?: string;
  surface?: string;
  latitude?: number;
  longitude?: number;
}): Promise<PrecheckResult> {
  return post('/api/posts/precheck', data);
}

export async function markNotHelpful(postId: string, surface = 'nearby'): Promise<{ flagged: boolean }> {
  return post(`/api/posts/${postId}/not-helpful`, { surface });
}

export async function solvePost(postId: string): Promise<{ message: string; post: { id: string; state: string; solved_at: string } }> {
  return patch(`/api/posts/${postId}/solve`);
}

// ============ SEEDED FACT DISMISSAL ============

export async function dismissSeededFact(factId: string): Promise<{ dismissed: boolean; factId: string }> {
  return post(`/api/posts/seeded/${factId}/dismiss`);
}

// ============ LIKES ============

export async function toggleLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  return post(`/api/posts/${postId}/like`);
}

export async function getLikes(postId: string, params?: {
  limit?: number;
  offset?: number;
}): Promise<{ likes: any[] }> {
  return get(`/api/posts/${postId}/likes`, params);
}

// ============ COMMENTS ============

export async function getComments(postId: string, params?: {
  limit?: number;
  offset?: number;
}): Promise<{ comments: PostComment[] }> {
  return get(`/api/posts/${postId}/comments`, params);
}

export async function addComment(postId: string, data: {
  comment: string;
  parentCommentId?: string;
}): Promise<{ message: string; comment: PostComment }> {
  return post(`/api/posts/${postId}/comments`, data);
}

export async function deleteComment(postId: string, commentId: string): Promise<{ message: string }> {
  return del(`/api/posts/${postId}/comments/${commentId}`);
}

export async function toggleCommentLike(postId: string, commentId: string): Promise<{ liked: boolean; likeCount: number }> {
  return post(`/api/posts/${postId}/comments/${commentId}/like`);
}

// ============ USER POSTS ============

export async function getUserPosts(userId: string, params?: {
  limit?: number;
  offset?: number;
  cursorCreatedAt?: string;
  cursorId?: string;
}): Promise<{ posts: Post[]; pagination: CursorPagination }> {
  return get(`/api/posts/user/${userId}`, params);
}

// ============ REPORTS ============

export async function reportPost(postId: string, data: {
  reason: 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'safety' | 'other';
  details?: string;
}): Promise<{ message: string }> {
  return post(`/api/posts/${postId}/report`, data);
}

export async function repostPost(postId: string): Promise<{ reposted: boolean; shareCount: number }> {
  return post(`/api/posts/${postId}/share`, { shareType: 'repost' });
}

export async function sharePost(postId: string): Promise<{ shared: boolean; shareCount: number }> {
  return post(`/api/posts/${postId}/share`, { shareType: 'external' });
}

// ============ v1.1 FEED PREFERENCES ============

export interface FeedPreferences {
  user_id: string;
  hide_deals_place: boolean;
  hide_alerts_place: boolean;
  show_politics_connections?: boolean;
  show_politics_place?: boolean;
}

export async function getFeedPreferences(): Promise<{ preferences: FeedPreferences }> {
  return get('/api/posts/feed-preferences');
}

export async function updateFeedPreferences(data: {
  hideDealsPlace?: boolean;
  hideAlertsPlace?: boolean;
  showPoliticsConnections?: boolean;
  showPoliticsPlace?: boolean;
}): Promise<{ message: string; preferences: FeedPreferences }> {
  return put('/api/posts/feed-preferences', data);
}

export async function muteTopicOnSurface(data: {
  postType: string;
  surface?: FeedSurface;
}): Promise<{ message: string }> {
  return post('/api/posts/mute/topic', data);
}

// ============ SAVES / BOOKMARKS ============

export async function toggleSave(postId: string): Promise<{ saved: boolean; message: string }> {
  return post(`/api/posts/${postId}/save`);
}

export async function getSavedPosts(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ posts: Post[] }> {
  return get('/api/posts/saved', params);
}
