// ============================================================
// IDENTITY FIREWALL TYPES
// Based on backend/database/migrations/20260301000001_identity_firewall_tables.sql
// Tables: BusinessSeat, SeatBinding, UserPrivacySettings, UserProfileBlock
// ============================================================

// ─── Enums ──────────────────────────────────────────────────

export type SeatInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type SeatBindingMethod = 'invite_accept' | 'owner_bootstrap' | 'migration';

export type SearchVisibilityLevel = 'everyone' | 'mutuals' | 'nobody';

export type ProfileVisibilityLevel = 'public' | 'followers' | 'private';

export type BlockScopeType = 'full' | 'search_only' | 'business_context';

export type NotificationContextType = 'personal' | 'business';
export type NotificationFirewallContext = 'personal' | 'audience' | 'platform';

export type BusinessRoleBase = 'owner' | 'admin' | 'editor' | 'staff' | 'viewer';

export type PublicIdentityType = 'local' | 'persona' | 'business' | 'home';
export type PersonaCategory = 'creator' | 'writer' | 'coach' | 'consultant' | 'community_leader' | 'public_figure' | 'other' | 'doctor' | 'therapist' | 'lawyer' | 'teacher' | 'tutor';
export type PersonaAudienceLabel = 'followers' | 'students' | 'patients' | 'clients' | 'customers' | 'subscribers' | 'members';
export type PersonaAudienceMode = 'open' | 'approval_required' | 'invite_only' | 'organization_managed';
export type PersonaFollowStatus = 'none' | 'pending' | 'active' | 'muted' | 'blocked' | 'removed';
export type PersonaRelationshipType = 'follower' | 'patient' | 'student' | 'client' | 'customer' | 'subscriber' | 'member';
export type PersonaNotificationLevel = 'all' | 'highlights' | 'none';

export interface PublicAuthorIdentity {
  type: PublicIdentityType;
  id: string;
  handle?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  href?: string | null;
  badges?: string[];
}

export interface LocalProfile {
  type: 'local';
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  tagline?: string | null;
  href?: string | null;
  badges: string[];
  locality: {
    city?: string | null;
    state?: string | null;
    neighborhood?: string | null;
    precision?: string | null;
  };
  stats: {
    reviews: number;
    gigsCompleted: number | null;
    marketplaceSales: number;
  };
  viewer: {
    relationshipStatus: string;
    isFollowingLocal: boolean;
    canMessage: boolean;
  };
  bridges: {
    audienceProfile?: AudienceProfile | null;
  };
  userId?: string | null;
}

export interface AudienceProfile {
  type: 'persona';
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  href?: string | null;
  publicLinks: Array<{ label: string; url: string }>;
  category: PersonaCategory | string;
  audienceLabel: PersonaAudienceLabel | string;
  audienceMode: PersonaAudienceMode;
  followerCount: number;
  postCount: number;
  broadcastEnabled: boolean;
  credential?: {
    status: string;
    label?: string | null;
  };
  organization?: {
    name: string;
    affiliationStatus: string;
  } | null;
  viewer: {
    isFollowing: boolean;
    relationshipType?: PersonaRelationshipType | string | null;
    notificationLevel: PersonaNotificationLevel;
    followStatus: PersonaFollowStatus | string;
    isOwner: boolean;
  };
  bridges: {
    localProfile?: LocalProfile | null;
  };
}

export interface BroadcastChannel {
  id: string;
  persona_id: string;
  title: string;
  description?: string | null;
  status: 'active' | 'paused' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface BroadcastMessage {
  id: string;
  channel_id: string;
  persona_id: string;
  body?: string | null;
  media?: Array<Record<string, unknown>>;
  // P1.10 — tier_or_above replaces 'subscribers'. The legacy value
  // remains in the union for one rollout window so unmigrated rows
  // and the server-side compat shim type-check cleanly.
  visibility: 'public' | 'followers' | 'tier_or_above' | 'subscribers';
  target_tier_rank?: number | null;
  status?: 'draft' | 'published' | 'archived' | 'removed';
  delivered_count?: number;
  read_count?: number;
  published_at?: string | null;
  created_at: string;
  // Locked-preview fields (set when the viewer's tier rank is below
  // the broadcast's target_tier_rank). Body / media / counts are
  // omitted in the locked variant.
  locked?: boolean;
  teaser?: string;
}

export interface PersonaFollower {
  id: string;
  status: Exclude<PersonaFollowStatus, 'none'> | string;
  relationshipType: PersonaRelationshipType | string;
  notificationLevel: PersonaNotificationLevel;
  publicVisibility: 'private' | 'visible_to_owner' | 'public' | string;
  source?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  follower: LocalProfile | null;
}

// One row of the fan-side "Beacons You Follow" management screen.
// Returned by `GET /api/personas/me/following`.
export interface BeaconFollowingItem {
  membershipId: string;
  persona: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    /** 'active' | 'paused' | 'suspended' — paused beacons surface greyed; suspended are dropped server-side. */
    status: string;
    verified: boolean;
  };
  fanHandle: string | null;
  notificationLevel: PersonaNotificationLevel;
  /** ISO timestamp; null when not actively muted. */
  mutedUntil: string | null;
  /** null for free (rank-1) memberships. */
  paidTier: { rank: number; name: string | null; priceCents: number } | null;
  latestPost: { id: string; snippet: string | null; createdAt: string } | null;
  unreadCount: number;
  followedAt: string;
  lastSeenAt: string | null;
}

export interface BeaconFollowingResponse {
  items: BeaconFollowingItem[];
  counts: { totalFollowing: number; unreadBeacons: number };
  pagination: { nextOffset: number | null; hasMore: boolean };
}

export type BeaconFollowingSort = 'activity' | 'recent' | 'alpha' | 'unread';

// One row of the owner-side "Your audience" management screen.
// Returned by `GET /api/personas/me/audience`. Privacy-correct: fan_handle
// is the per-beacon pseudonym, not the fan's Pantopus username. The
// `joinedMonth` is month-granularity by design (timing-attack invariant
// from audience-profile v2 §6.1).
export interface AudienceMemberItem {
  membershipId: string;
  fanHandle: string;
  fanDisplayName: string;
  fanAvatarUrl: string | null;
  tier: { rank: number; name: string };
  /** "YYYY-MM" — never includes day or time. */
  joinedMonth: string | null;
  tenureMonths: number;
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  verifiedLocal?: boolean;
}

export interface AudienceMembersResponse {
  persona: AudienceProfile | null;
  items: AudienceMemberItem[];
  counts: {
    totalActive: number;
    pending: number;
    byTier: { 1: number; 2: number; 3: number; 4: number };
  };
  pagination: { nextOffset: number | null; hasMore: boolean };
}

export type AudienceMembersSort = 'recent' | 'tenure' | 'tier' | 'alpha';

export type AudienceMemberAction = 'approve' | 'decline' | 'remove' | 'mute' | 'unmute';

export interface PersonaFollowerCounts {
  total: number;
  pending: number;
  active: number;
  muted: number;
  blocked: number;
  removed: number;
  [status: string]: number;
}

export interface BroadcastAnalyticsSummary {
  deliveredCount: number;
  readCount: number;
}

export interface IdentityCenterPayload {
  privateAccount: Record<string, unknown> | null;
  localProfile: LocalProfile | null;
  audienceProfile: AudienceProfile | null;
  bridges: {
    show_persona_on_local: boolean;
    show_local_on_persona: boolean;
    bridge_label?: string | null;
  };
  homes: PublicAuthorIdentity[];
  businessProfiles: PublicAuthorIdentity[];
  /**
   * P2.6 / unified-IA §8: extra fields the unified Profiles & Privacy
   * surface needs. Optional so existing consumers keep compiling; the
   * backend always populates them.
   */
  personaCount?: number;
  blockCounts?: {
    personal: number;
    audience: number;
  };
}

export interface ViewAsPreviewSection {
  key: string;
  label: string;
}

export interface ViewAsPreviewPost {
  id: string;
  title?: string | null;
  content?: string | null;
  media_urls?: string[] | null;
  media_types?: string[] | null;
  post_type?: string | null;
  post_format?: string | null;
  visibility?: string | null;
  audience?: string | null;
  distribution_targets?: string[] | null;
  profile_visibility_scope?: string | null;
  show_on_profile?: boolean | null;
  location_precision?: string | null;
  location_name?: string | null;
  tags?: string[] | null;
  like_count?: number | null;
  comment_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  author?: PublicAuthorIdentity | null;
}

export interface ViewAsPreviewBroadcast {
  id: string;
  body?: string | null;
  media?: Array<Record<string, unknown>>;
  visibility?: string | null;
  status?: string | null;
  delivered_count?: number;
  read_count?: number;
  created_at?: string | null;
  published_at?: string | null;
}

export interface ViewAsPreview {
  surface: 'local' | 'persona' | string;
  viewer: string;
  viewerLabel?: string;
  profile: LocalProfile | AudienceProfile;
  /**
   * P2.7 / unified-IA §8.2 — the actual serializer output for this
   * viewer mode. Identical to `profile` but typed loosely so the
   * Privacy preview UI can render and key-walk without coupling to
   * the LocalProfile/AudienceProfile shape.
   */
  visible?: Record<string, unknown> | null;
  /**
   * P2.7 — list of forbidden personal-side identity field names that
   * the serializer dropped from `visible` for this viewer. Drives the
   * "Hidden from this viewer" panel.
   */
  hidden?: string[];
  context?: Record<string, unknown>;
  visibleSections?: ViewAsPreviewSection[];
  protectedSections?: ViewAsPreviewSection[];
  counts?: {
    visiblePosts: number;
    hiddenPosts: number;
    visibleBroadcasts: number;
    hiddenBroadcasts: number;
  };
  sample?: {
    posts: ViewAsPreviewPost[];
    broadcasts: ViewAsPreviewBroadcast[];
  };
}

export type ProfileDiscoveryResultType =
  | 'local_profile'
  | 'public_profile'
  | 'business'
  | 'home'
  | 'task'
  | 'listing';

export type ProfileDiscoveryActionKind =
  | 'open'
  | 'follow_public_profile'
  | 'follow_local_profile'
  | 'connect'
  | 'claim_home';

export interface ProfileDiscoveryLinkedProfile {
  type: 'local_profile' | 'public_profile';
  title: string;
  href: string | null;
}

export interface ProfileDiscoveryResult {
  id: string;
  type: ProfileDiscoveryResultType;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  imageUrl?: string | null;
  href: string;
  badges?: string[];
  action?: {
    kind: ProfileDiscoveryActionKind;
    label: string;
    disabled?: boolean;
    state?: string | null;
  };
  linkedProfile?: ProfileDiscoveryLinkedProfile | null;
}

export interface ProfileDiscoverySearchResponse {
  results: ProfileDiscoveryResult[];
  counts?: Record<string, number>;
}

// ─── BusinessSeat ───────────────────────────────────────────

/** A seat is an opaque business identity — never reveals the real user behind it */
export interface BusinessSeat {
  id: string;
  business_user_id: string;
  display_name: string;
  display_avatar_file_id?: string | null;
  role_base: BusinessRoleBase;
  contact_method?: string | null;
  is_active: boolean;
  invited_by_seat_id?: string | null;
  invite_token_hash?: string | null;
  invite_email?: string | null;
  invite_status: SeatInviteStatus;
  accepted_at?: string | null;
  deactivated_at?: string | null;
  deactivated_reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Seat list view — compact fields for the team panel */
export interface SeatListItem {
  id: string;
  business_user_id: string;
  display_name: string;
  display_avatar_file_id?: string | null;
  role_base: BusinessRoleBase;
  title?: string | null;
  contact_method?: string | null;
  is_active: boolean;
  invite_status: SeatInviteStatus;
  invite_email?: string | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
  /** True if this seat belongs to the viewer */
  is_you?: boolean;
}

/** Seat detail view — all fields */
export interface SeatDetail extends BusinessSeat {
  /** True if this seat belongs to the viewer */
  is_you?: boolean;
}

// ─── MySeat — returned from GET /my-seats ────────────────────

export interface MySeat {
  seat_id: string;
  business_user_id: string;
  business_name: string;
  business_username: string;
  business_logo_file_id?: string | null;
  business_type?: string | null;
  display_name: string;
  display_avatar_file_id?: string | null;
  role_base: BusinessRoleBase;
  contact_method?: string | null;
}

// ─── Invite Details — returned from GET /seats/invite-details ─

export interface InviteDetails {
  seat_id: string;
  business: {
    id: string;
    username?: string;
    name?: string;
  };
  display_name: string;
  role_base: BusinessRoleBase;
  invite_email?: string | null;
  created_at: string;
}

// ─── UserPrivacySettings ────────────────────────────────────

export interface UserPrivacySettings {
  user_id: string;
  search_visibility: SearchVisibilityLevel;
  findable_by_name: boolean;
  findable_by_email: boolean;
  findable_by_phone: boolean;
  profile_default_visibility: ProfileVisibilityLevel;
  show_gig_history: ProfileVisibilityLevel;
  show_neighborhood: ProfileVisibilityLevel;
  show_home_affiliation: ProfileVisibilityLevel;
  created_at: string;
  updated_at: string;
}

export interface UpdatePrivacySettingsPayload {
  search_visibility?: SearchVisibilityLevel;
  findable_by_name?: boolean;
  findable_by_email?: boolean;
  findable_by_phone?: boolean;
  profile_default_visibility?: ProfileVisibilityLevel;
  show_gig_history?: ProfileVisibilityLevel;
  show_neighborhood?: ProfileVisibilityLevel;
  show_home_affiliation?: ProfileVisibilityLevel;
}

// ─── UserProfileBlock ───────────────────────────────────────

export interface UserProfileBlock {
  id: string;
  blocked_user_id: string;
  block_scope: BlockScopeType;
  reason?: string | null;
  created_at: string;
  blocked?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string | null;
  };
}

export interface CreateBlockPayload {
  blocked_user_id: string;
  block_scope?: BlockScopeType;
  reason?: string;
}

// ─── Seat Invite Payloads ───────────────────────────────────

export interface CreateSeatInvitePayload {
  display_name: string;
  role_base?: BusinessRoleBase;
  invite_email?: string;
  title?: string;
  contact_method?: string;
  notes?: string;
}

export interface AcceptInvitePayload {
  token: string;
  display_name?: string;
}

export interface DeclineInvitePayload {
  token: string;
}

export interface UpdateSeatPayload {
  display_name?: string;
  role_base?: BusinessRoleBase;
  title?: string;
  contact_method?: string;
  notes?: string;
}

// ─── Notification (extended) ────────────────────────────────

export interface NotificationWithContext {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  icon: string;
  link?: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
  context?: NotificationFirewallContext;
  context_type?: NotificationContextType;
  context_id?: string | null;
}
