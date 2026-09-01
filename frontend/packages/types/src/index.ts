// ============================================================
// SHARED TYPESCRIPT TYPES
// Types shared between web and mobile applications
// Based on backend database schema
// ============================================================

// ─── Re-exports from category constants ──────────────────────

export {
  GIG_CATEGORIES,
  GIG_BROWSE_CATEGORIES,
  PRO_CATEGORIES,
  DELIVERY_CATEGORIES,
} from './categories';
export type { GigCategory, GigBrowseCategory, ProCategory, DeliveryCategory } from './categories';

// ─── Re-exports from domain type files ───────────────────────

export type {
  PostType,
  PostVisibility,
  PostFormat,
  LocationPrecision as PostLocationPrecision,
  VisibilityScope as PostVisibilityScope,
  SafetyAlertKind,
  FeedSurface,
  DistributionTarget,
  PostAs,
  PersonaPostAudience,
  Audience,
  FeedScope,
  TrustLevel,
  MapLayerType,
  PostCreator,
  PostComment,
  PostingIdentity,
  Post,
  MatchedBusiness,
} from './post';

export type { Notification } from './notification';

// ─── Re-exports from AI agent types ─────────────────────────

export type {
  GigDraft,
  ListingDraft,
  PostDraft,
  ClarifyingQuestionAI,
  MailKeyFact,
  MailRecommendedAction,
  MailSummary,
  PlaceBriefHeadline,
  PlaceBriefSource,
  PlaceBrief,
  HubTodayLocation,
  HubTodayWeather,
  HubTodayAQI,
  HubTodayAlert,
  HubTodaySignal,
  HubTodayAction,
  HubTodayMeta,
  HubToday,
  NeighborhoodPulse,
  PulseSignal,
  PulseSignalAction,
  PulseProperty,
  PulseNeighborhood,
  SeasonalContext,
  CommunityDensity,
  PulseSource,
  PulseMeta,
  UserNotificationPreferences,
  AIDraftType,
  AIChatDraft,
  AIChatMessage,
  AIConversation,
  AIStreamEvent,
  AIChatRequest,
  AIDraftGigRequest,
  AIDraftGigResponse,
  AIDraftListingRequest,
  AIDraftListingResponse,
  AIDraftPostRequest,
  AIDraftPostResponse,
  AISummarizeMailRequest,
} from './ai';

// ─── Re-exports from identity firewall types ────────────────

export type {
  SeatInviteStatus,
  SeatBindingMethod,
  SearchVisibilityLevel,
  ProfileVisibilityLevel,
  BlockScopeType,
  NotificationContextType,
  NotificationFirewallContext,
  BusinessSeat,
  SeatListItem,
  SeatDetail,
  MySeat,
  InviteDetails,
  UserPrivacySettings,
  UpdatePrivacySettingsPayload,
  UserProfileBlock,
  CreateBlockPayload,
  CreateSeatInvitePayload,
  AcceptInvitePayload,
  DeclineInvitePayload,
  UpdateSeatPayload,
  NotificationWithContext,
  PublicIdentityType,
  PersonaCategory,
  PersonaAudienceLabel,
  PersonaAudienceMode,
  PersonaFollowStatus,
  PersonaRelationshipType,
  PersonaNotificationLevel,
  PublicAuthorIdentity,
  LocalProfile,
  AudienceProfile,
  BroadcastChannel,
  BroadcastMessage,
  PersonaFollower,
  PersonaFollowerCounts,
  BeaconFollowingItem,
  BeaconFollowingResponse,
  BeaconFollowingSort,
  AudienceMemberItem,
  AudienceMembersResponse,
  AudienceMembersSort,
  AudienceMemberAction,
  BroadcastAnalyticsSummary,
  IdentityCenterPayload,
  ViewAsPreviewSection,
  ViewAsPreviewPost,
  ViewAsPreviewBroadcast,
  ViewAsPreview,
  ProfileDiscoveryResultType,
  ProfileDiscoveryActionKind,
  ProfileDiscoveryLinkedProfile,
  ProfileDiscoveryResult,
  ProfileDiscoverySearchResponse,
} from './identity';

// ─── Re-exports from home intelligence types ────────────────

export type {
  DimensionScore,
  HomeHealthScore,
  SeasonalChecklistItem,
  SeasonalChecklist,
  SeasonalChecklistCarryover,
  SeasonalChecklistHistory,
  BillBenchmark,
  BillBenchmarkInsufficient,
  BillTrendData,
  PropertyValueData,
  HomeTimelineItem,
} from './homeIntelligence';

// ─── Re-exports from Place Intelligence contract ────────────

export type {
  PlaceTier,
  PlaceBand,
  PlaceSectionAccess,
  PlaceSectionStatus,
  PlaceCoverage,
  PlaceGroup,
  WeatherConditionCode,
  PlaceWeatherHour,
  PlaceWeatherDay,
  PlaceWeatherData,
  AirQualityCategory,
  PlaceAirQualityData,
  WeatherAlertSeverity,
  PlaceWeatherAlert,
  PlaceAlertsData,
  PlaceSunriseSunsetData,
  FloodRiskLevel,
  PlaceFloodNfipData,
  PlaceFloodData,
  LeadPaintRisk,
  SeismicDesignCategory,
  PlaceSeismicData,
  WildfireHazardClass,
  PlaceWildfireData,
  PlaceLeadRadonData,
  PlaceDrinkingWaterData,
  PlaceEpaFacility,
  PlaceEnvironmentalHazardsData,
  PlaceDensityBucket,
  PlaceBlockDensityData,
  PlaceCensusContextData,
  BillUtilityKind,
  BenchmarkComparison,
  PlaceBillBenchmarkData,
  IncentiveLevel,
  IncentiveType,
  PlaceIncentive,
  PlaceIncentivesData,
  PlaceRentBandData,
  RealRentScope,
  RealRentStanding,
  RealRentState,
  PlaceRealRentData,
  PlaceExemptionCheckData,
  CivicLevel,
  PlaceCivicDistrict,
  PlaceCivicRepresentative,
  PlaceCivicDistrictsData,
  PlaceBallotRace,
  PlacePollingPlace,
  PlaceCivicElectionData,
  PlaceYourHomeData,
  HomeSystemSource,
  HomeSystemStatus,
  PlaceHomeSystem,
  PlaceHomeSystemsSummary,
  PlaceHomeSystemsData,
  GoodDayVerdict,
  HeatRiskLevel,
  PlaceHeatRiskDay,
  PlaceFreezeWindow,
  PlaceHeatColdData,
  PlaceGoodDayTile,
  PlaceGoodDayData,
  PlaceSectionDataMap,
  PlaceSectionId,
  PlaceSectionMeta,
  PlaceSectionEnvelope,
  PlaceSection,
  PlaceAddressRef,
  PlaceGroupBlock,
  PlaceIntelligence,
} from './placeIntelligence';

export {
  PLACE_GROUPS,
  PLACE_GROUP_LABELS,
  PLACE_DENSITY_LABELS,
  PLACE_SECTION_IDS,
  PLACE_SECTION_META,
} from './placeIntelligence';

// ─── Re-exports from home entity types ──────────────────────

export type {
  HomeRecordVisibility,
  HomeTaskType,
  HomeTaskStatus,
  HomeTaskPriority,
  HomeTask,
  HomeBillType,
  HomeBillStatus,
  HomeBill,
  HomePackageStatus,
  HomePackage,
  HomePetSpecies,
  HomePet,
  HomePollType,
  HomePollStatus,
  HomePollOption,
  HomePoll,
  HomeDocumentType,
  HomeDocument,
  HomeEmergencyType,
  HomeEmergency,
  HomeAccessType,
  HomeAccessSecret,
  HomeVendor,
  HomeAuditLogEntry,
  GuestPassKind,
  HomeGuestPass,
  HomeRoleBase,
  HomeAgeBand,
  HomeMember,
  OwnershipClaimState,
  HomeOwnershipClaim,
  ResidencyClaimStatus,
  HomeResidencyClaim,
  MaintenanceType,
  MaintenanceSeason,
  HomeMaintenanceTemplate,
  HomeMaintenanceLog,
  HomeDashboard,
  HomeIssue,
  HomeCalendarEvent,
} from './home';

// ─── Re-exports from mail compose types ─────────────────────

export type {
  MailIntent,
  DestinationMode,
  VisibilityMode,
  MailClass,
  InkSelection,
  StationeryTheme,
  OutcomeType,
  CeremonyTier,
  PorchCallTier,
  ComposeContentDraft,
  ComposeState,
  ComputedBackendPayload,
  MailTypeConfig,
} from './mailCompose';
export {
  MAIL_TYPE_CONFIGS,
  getMailClass,
  getCeremonyTier,
  getPorchCallTier,
} from './mailCompose';

// ─── Re-exports from wallet types ───────────────────────────

export type {
  Wallet,
  WalletTransactionType,
  WalletTransactionDirection,
  WalletTransactionStatus,
  WalletTransaction,
  EarnWithdrawalMethod,
  EarnWallet,
  EarningsSummary,
  SpendingSummary,
} from './wallet';

// ─── Re-exports from entity type taxonomy ────────────────────

export type { EntityType, PaymentMode, EntityTypeConfig } from './entityTypes';
export { ENTITY_TYPE_CONFIG, ENTITY_TYPES, getEntityTypeConfig } from './entityTypes';

// ─── Re-exports from business types ─────────────────────────

export type {
  BusinessUser,
  BusinessProfile,
  BusinessHours,
  BusinessSpecialHours,
  CatalogCategory,
  CatalogItemKind,
  CatalogItemStatus,
  CatalogItem,
  BusinessPage,
  PageBlock,
  BusinessRoleBase,
  BusinessTeamMember,
  BusinessMembership,
  BusinessReview,
  BusinessReviewsSummary,
  BusinessInsights,
  BusinessDashboard,
  PageRevision,
} from './business';

// ─── Re-exports from relationship types ─────────────────────

export type {
  RelationshipStatus,
  RelationshipUser,
  Relationship,
  ConnectionRequest,
} from './relationship';

export type {
  GigStatus,
  GigBidStatus,
  CounterStatus,
  AssignmentStatus,
  ChangeOrderStatus,
  ChangeOrderType,
  LocationPrecision,
  RevealPolicy,
  VisibilityScope,
  GigOriginMode,
  GigSourceType,
  GigUserSummary,
  GigDetail,
  GigListItem,
  GigBidWithUser,
  Assignment,
  Review,
  ReviewWithUser,
  GigChangeOrder,
  QuestionStatus,
  GigQuestion,
  GigCluster,
  GigStack,
  BrowseSections,
  BrowseResponse,
} from './gig';

// Concrete re-exports (renamed to avoid collision with legacy types below)
export type { Gig as GigSchema, GigBid as GigBidSchema } from './gig';

export type {
  ActivityType,
  ActivityStatus,
  Activity,
  SupportTrainType,
  SupportTrainStatus,
  SharingMode,
  SupportTrain,
  SupportTrainRecipientProfile,
  OrganizerRole,
  SupportTrainOrganizer,
  SlotLabel,
  SupportMode,
  SlotStatus,
  SupportTrainSlot,
  ReservationStatus,
  ContributionMode,
  SupportTrainReservation,
  FundStatus,
  SupportTrainFund,
  ContributionPaymentStatus,
  SupportTrainFundContribution,
  SupportTrainUpdate,
  InviteStatus,
  SupportTrainInvite,
  DraftFromStoryRequest,
  DraftFromStoryResponse,
  CreateSupportTrainRequest,
  UpdateSupportTrainRequest,
  GenerateSlotsPreset,
  GenerateSlotsRequest,
  ReserveSlotRequest,
  CancelReservationRequest,
  RevealSupportTrainAddressResponse,
  NearbySupportTrainListItem,
  SupportTrainDeliveryLocation,
} from './supportTrain';

// ─── Re-exports from Calendarly scheduling contract (W0) ────

export type {
  SchedulingOwnerType,
  SchedulingOwnerRef,
  BookingPageVisibility,
  SchedulingPageState,
  RefundPolicy,
  CancellationPolicy,
  CancellationPolicyValue,
  BookingPage,
  BookingPageInput,
  SlugCheckResult,
  EventTypeLocationMode,
  AssignmentMode,
  EventTypeVisibility,
  IntakeQuestionFieldType,
  EventTypeLocation,
  EventTypePricing,
  EventType,
  IntakeQuestion,
  AssigneeSubjectType,
  EventTypeAssignee,
  EventTypeAssignment,
  EventTypeDetail,
  EventTypeInput,
  AvailabilitySchedule,
  AvailabilityRule,
  WeeklyHours,
  AvailabilityOverride,
  DateOverride,
  AvailabilityBlock,
  AvailabilityBundle,
  BookingLimits,
  NoticeRules,
  NotificationPreferences,
  BookingStatus,
  BookingSource,
  RsvpStatus,
  Invitee,
  BookingAnswer,
  Booking,
  BookingAttendee,
  BookingDetail,
  BookingsSummary,
  BookingCreateInput,
  BookingSlot,
  SlotConflictCode,
  SlotConflict,
  OneOffLink,
  OneOffLinkInput,
  PublicEventType,
  PublicPageView,
  PublicBookingPage,
  PublicSlotsResponse,
  PublicOneOff,
  PublicBookingInput,
  PublicBookingSummary,
  ManageBookingRow,
  CreatePublicBookingResult,
  BookingManageActions,
  BookingPayment,
  BookingManageView,
  PublicWaitlistInput,
  WorkflowTrigger,
  MessageChannel,
  WorkflowAction,
  Workflow,
  WorkflowInput,
  MessageTemplate,
  MessageTemplateInput,
  MessageTemplatePreview,
  PaymentsStatus,
  Package,
  PackageInput,
  MyPackageCredit,
  BuyPackageResult,
  InvoiceLineItem as SchedulingInvoiceLineItem,
  Invoice,
  ConnectedCalendar,
  ResourceType,
  WhoCanBook,
  Resource,
  ResourceInput,
  ResourceBookingInput,
  VisitType,
  Visit,
  VisitInput,
  FindATimeMode,
  FindATimeQuery,
  FindATime,
  WhosFree,
  TeamAvailability,
  PollStatus,
  PollVoteValue,
  PollOption,
  PollVote,
  Poll,
  PollDetail,
  PollInput,
  PollVoteInput,
  WaitlistStatus,
  WaitlistEntry,
  NoShowInsights,
  TeamInsights,
  HomeCalendarUnionSource,
  HomeCalendarUnionEvent,
  ValidationDetail,
  DecodedSchedulingError,
} from './scheduling';

export type {
  ListingStatus,
  ListingLayer,
  ListingType,
  ListingCategory,
  ListingCondition,
  ListingLocationPrecision,
  ListingRevealPolicy,
  ListingVisibilityScope,
  Listing,
  ListingUserSummary,
  ListingDetail,
  ListingListItem,
  ListingQuestionStatus,
  ListingQuestion,
  ListingMessage,
  BoundsBox,
  MarketplaceBrowseResponse,
  MarketplaceDiscoverResponse,
  ListingCategoryCluster,
  MarketplaceAutocompleteResponse,
} from './listing';

// ============ MONTHLY RECEIPT TYPES ============

export interface MonthlyReceipt {
  period: { year: number; month: number; label: string };
  earnings: {
    total_cents: number;
    gig_count: number;
    top_category: string | null;
  };
  spending: {
    total_cents: number;
    gig_count: number;
  };
  marketplace: {
    listings_sold: number;
    listings_bought: number;
    free_items_claimed: number;
  };
  community: {
    posts_created: number;
    connections_made: number;
    neighbors_helped: number;
  };
  reputation: {
    current_rating: number;
    reviews_received: number;
    rating_change: number | null;
  };
  highlight: string;
}

export interface InviteProgress {
  total_invited: number;
  total_converted: number;
  unlocked_features: string[];
  next_unlock: {
    feature: string;
    label: string;
    invites_needed: number;
    invites_remaining: number;
  } | null;
}

export const INVITE_FEATURE_TIERS = [
  { key: 'activity_map', label: 'Activity Map', threshold: 1 },
  { key: 'neighborhood_insights', label: 'Neighborhood Insights', threshold: 3 },
  { key: 'priority_matching', label: 'Priority Matching', threshold: 5 },
  { key: 'founding_badge', label: 'Founding Neighbor Badge', threshold: 10 },
] as const;

export const FEATURE_LABELS: Record<string, string> = {
  activity_map: 'Activity Map',
  neighborhood_insights: 'Neighborhood Insights',
  priority_matching: 'Priority Matching',
  founding_badge: 'Founding Neighbor Badge',
};

// ============ USER TYPES ============

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  middleName?: string | null;
  name: string; // Keep this - it's the full name
  phone_number?: string;
  profile_picture_url?: string;
  profilePicture?: string;
  profile_picture?: string;
  avatar_url?: string;
  bio?: string;
  date_of_birth?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  skills?: string[];
  interests?: string[];
  average_rating?: number;
  total_ratings?: number;
  is_verified?: boolean;
  verification_method?: 'email' | 'phone' | 'id' | 'landlord';
  stripe_account_id?: string;
  // Reliability metrics
  no_show_count?: number;
  late_cancel_count?: number;
  gigs_completed?: number;
  gigs_posted?: number;
  reliability_score?: number;
  review_count?: number;
  role?: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface GigIncident {
  id: string;
  gig_id: string;
  reported_by: string;
  reported_against: string;
  type: 'no_show_worker' | 'no_show_poster' | 'dispute' | 'safety';
  description?: string;
  evidence_urls?: string[];
  status: 'open' | 'resolved' | 'dismissed';
  resolution?: string;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

export interface UserProfile extends User {
  total_gigs_completed?: number;
  total_gigs_posted?: number;
  total_earnings?: number;
  portfolio_items?: PortfolioItem[];
  // Additional profile fields returned by the backend
  lastName?: string;
  last_name?: string;
  middle_name?: string;
  tagline?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  socialLinks?: Record<string, string>;
  social_links?: Record<string, string>;
  website?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  address_verified?: boolean;
  /** Household residency shown on public profile (from Home / HomeOccupancy). */
  residency?: {
    hasHome: boolean;
    city: string | null;
    state: string | null;
    verified: boolean;
  };
  profilePicture?: string;
  // Notification / privacy settings
  email_notifications?: boolean;
  push_notifications?: boolean;
  profile_visibility?: 'public' | 'registered' | 'private';
  profileVisibility?: 'public' | 'registered' | 'private';
  show_email?: boolean;
  showEmail?: boolean;
  show_phone?: boolean;
  showPhone?: boolean;
  // Reviews (populated on public profiles)
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string;
    reviewer?: Pick<User, 'id' | 'username' | 'name' | 'profile_picture_url'>;
    created_at: string;
  }>;
}

// ============ HOME/ADDRESS TYPES ============

export interface Home {
  id: string;
  address: string;
  unit_number?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  owner_id?: string;
  property_manager_id?: string;
  profile_picture_url?: string;
  home_type?: 'apartment' | 'house' | 'condo' | 'townhouse' | 'other';
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  public_info?: {
    wifi_password?: string;
    house_rules?: string;
    parking_info?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface HomeOccupancy {
  id: string;
  home_id: string;
  user_id: string;
  relationship: 'owner' | 'tenant' | 'roommate' | 'guest' | 'sublease';
  is_primary_residence: boolean;
  move_in_date: string;
  move_out_date?: string;
  is_current: boolean;
  verified_by?: string;
  verification_method?: 'landlord' | 'escrow' | 'utility_bill' | 'lease';
  created_at: string;
}

// ============ GIG TYPES ============

export interface Gig {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category: string;
  gig_type: 'one_time' | 'recurring' | 'urgent';
  location: {
    type: 'Point';
    coordinates: [number, number];
    latitude?: number;
    longitude?: number;
  };
  location_type: 'in_person' | 'remote' | 'hybrid';
  address?: string;
  budget_min?: number;
  budget_max?: number;
  budget_type?: 'fixed' | 'hourly' | 'negotiable';
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  deadline?: string;
  required_skills?: string[];
  estimated_duration?: string;
  image_urls?: string[];
  accepted_bid_id?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  // Cancellation system
  cancellation_policy?: 'flexible' | 'standard' | 'strict';
  scheduled_start?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  cancellation_zone?: number | null;
  cancellation_fee?: number | null;
  // Proof of completion
  completion_note?: string | null;
  completion_photos?: string[];
  completion_checklist?: { item: string; done: boolean }[];
  owner_confirmation_note?: string | null;
  owner_satisfaction?: number | null;
  // Payment integration
  payment_id?: string | null;
  payment_status?: PaymentStatus;
  price?: number;
}

export interface GigBid {
  id: string;
  gig_id: string;
  bidder_id: string;
  bid_amount: number;
  proposed_timeline: string;
  message?: string;
  status:
    | 'pending'
    | 'pending_payment'
    | 'accepted'
    | 'rejected'
    | 'withdrawn'
    | 'expired'
    | 'countered';
  created_at: string;
  updated_at: string;
  // Bid expiry
  expires_at?: string | null;
  // Withdrawal tracking
  withdrawal_reason?: string | null;
  withdrawn_at?: string | null;
  // Counter-offer
  counter_amount?: number | null;
  counter_message?: string | null;
  countered_at?: string | null;
  countered_by?: string | null;
  counter_status?: 'pending' | 'accepted' | 'declined' | null;
  // Pending payment tracking
  pending_payment_expires_at?: string | null;
}

export interface GigWithDetails extends Gig {
  poster: Pick<User, 'id' | 'username' | 'name' | 'profile_picture_url' | 'average_rating'>;
  accepted_bid?: GigBid & {
    bidder: Pick<User, 'id' | 'username' | 'name' | 'profile_picture_url'>;
  };
  bids_count?: number;
  viewer_has_saved?: boolean;
  schedule_type?: string;
  engagement_mode?: string | null;
  user_id?: string;
  is_urgent?: boolean;
  tags?: string[];
  items?: unknown[];
  exact_address?: string | null;
  exact_city?: string | null;
  exact_state?: string | null;
  exact_zip?: string | null;
  origin_home_id?: string | null;
  origin_place_id?: string | null;
  origin_mode?: string | null;
}

// ============ MAILBOX TYPES ============

export interface Mail {
  id: string;
  recipient_home_id?: string;
  recipient_user_id?: string;
  mail_type?: 'letter' | 'packet' | 'bill' | 'book' | 'notice' | 'promotion' | 'other';
  display_title?: string;
  preview_text?: string;
  primary_action?: 'open' | 'review' | 'read' | 'view_bill' | 'open_packet';
  action_required?: boolean;
  ack_required?: boolean;
  ack_status?: 'pending' | 'acknowledged';
  recipient_type?: 'user' | 'home';
  recipient_id?: string;
  address_id?: string;
  mail_extracted?: Record<string, unknown>;
  delivery_target_type?: 'home' | 'user';
  delivery_target_id?: string;
  address_home_id?: string;
  attn_user_id?: string;
  attn_label?: string;
  delivery_visibility?: 'home_members' | 'attn_only' | 'attn_plus_admins';
  sender_user_id?: string;
  sender_business_name?: string;
  sender_address?: string;
  type:
    | 'ad'
    | 'letter'
    | 'bill'
    | 'statement'
    | 'notice'
    | 'package'
    | 'newsletter'
    | 'promotion'
    | 'document'
    | 'other';
  subject?: string;
  content: string;
  attachments?: string[];
  viewed: boolean;
  viewed_at?: string;
  archived: boolean;
  starred: boolean;
  payout_amount?: number;
  payout_status?: 'pending' | 'paid' | 'failed';
  category?: string;
  tags?: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expires_at?: string;
  links?: MailLink[];
  created_at: string;
}

export interface MailLink {
  id: string;
  mail_item_id: string;
  target_type: 'bill' | 'issue' | 'package' | 'document';
  target_id: string;
  created_by: 'system' | 'user';
  status: 'active' | 'undone';
  created_at: string;
  updated_at: string;
}

export interface AdCampaign {
  id: string;
  business_user_id: string;
  name: string;
  description?: string;
  target_cities?: string[];
  target_states?: string[];
  target_zipcodes?: string[];
  target_radius_meters?: number;
  budget_total: number;
  budget_remaining: number;
  price_per_view: number;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  starts_at?: string;
  ends_at?: string;
  sent_count: number;
  viewed_count: number;
  clicked_count: number;
  created_at: string;
  updated_at: string;
}

// ============ CHAT TYPES ============

export interface ChatRoom {
  id: string;
  room_type: 'direct' | 'group' | 'gig' | 'home';
  type?: 'direct' | 'group' | 'gig' | 'home' | string;
  room_name?: string;
  name?: string;
  room_description?: string;
  room_image_url?: string;
  created_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ReactionSummary {
  reaction: string;
  count: number;
  users: { id: string; name: string }[];
  reacted_by_me: boolean;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  user_id?: string;
  sender?: Pick<User, 'id' | 'username' | 'name' | 'profile_picture_url'> & Record<string, any>;
  message_text?: string;
  message?: string;
  content?: string;
  message_type:
    | 'text'
    | 'image'
    | 'video'
    | 'file'
    | 'audio'
    | 'location'
    | 'system'
    | 'gig_offer'
    | 'listing_offer';
  type?: ChatMessage['message_type'] | string;
  topic_id?: string;
  file_ids?: string[];
  attachments?: unknown[];
  metadata?: Record<string, any>;
  reply_to_id?: string;
  is_edited: boolean;
  edited?: boolean;
  edited_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
  reactions?: ReactionSummary[];
  _optimistic?: boolean;
  _failed?: boolean;
  _clientMessageId?: string;
}

export interface ChatParticipant {
  id: string;
  room_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  unread_count: number;
  last_read_at?: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
}

export interface ChatRoomWithDetails extends ChatRoom {
  participants: (ChatParticipant & {
    user: Pick<User, 'id' | 'username' | 'name' | 'profile_picture_url'>;
  })[];
  last_message?: ChatMessage;
  unread_count: number;
}

// ============ CONVERSATION TOPIC TYPES ============

export interface ConversationTopic {
  id: string;
  conversation_user_id_1: string;
  conversation_user_id_2: string;
  topic_type: 'general' | 'task' | 'listing' | 'delivery' | 'home' | 'business';
  topic_ref_id?: string;
  title: string;
  status: 'active' | 'completed' | 'archived';
  created_by?: string;
  created_at: string;
  last_activity_at: string;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  other_participant_id: string;
  other_participant_name: string;
  other_participant_username: string;
  other_participant_avatar: string | null;
  room_ids: string[];
  total_message_count: number;
  total_unread: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  topics: ConversationTopic[];
  _type: 'conversation';
}

export interface GroupRoomSummary {
  id: string;
  room_type: 'group' | 'home';
  room_name: string;
  description?: string;
  gig_id?: string;
  home_id?: string;
  total_message_count: number;
  total_unread: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  topics: ConversationTopic[];
  _type: 'room';
}

export type UnifiedConversationItem = ConversationSummary | GroupRoomSummary;

// ============ FILE TYPES ============

export interface FileUpload {
  id: string;
  user_id: string;
  home_id?: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  file_extension: string;
  file_type:
    | 'profile_picture'
    | 'portfolio_image'
    | 'portfolio_video'
    | 'portfolio_document'
    | 'home_photo'
    | 'home_video'
    | 'home_document'
    | 'resume'
    | 'certification';
  file_context?: string;
  visibility: 'public' | 'private';
  display_order?: number;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    width?: number;
    height?: number;
    thumbnails?: {
      small?: string;
      medium?: string;
      large?: string;
    };
  };
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem extends FileUpload {
  category?: string;
}

// ============ PAYMENT TYPES ============

export interface StripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_status: 'pending' | 'active' | 'restricted' | 'disabled';
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  card_payments_enabled?: boolean;
  transfers_enabled?: boolean;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
}

// Payment lifecycle states (matches backend paymentStateMachine.js)
export type PaymentStatus =
  | 'none'
  | 'setup_pending'
  | 'ready_to_authorize'
  | 'authorize_pending'
  | 'authorized'
  | 'authorization_failed'
  | 'capture_pending'
  | 'captured_hold'
  | 'transfer_scheduled'
  | 'transfer_pending'
  | 'transferred'
  | 'refund_pending'
  | 'refunded_partial'
  | 'refunded_full'
  | 'disputed'
  | 'canceled'
  // Legacy values
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'succeeded'
  | 'requires_confirmation';

export type PaymentType =
  | 'gig_payment'
  | 'tip'
  | 'cancellation_fee'
  | 'subscription'
  | 'deposit'
  | 'withdrawal';

export interface Payment {
  id: string;
  payer_id: string;
  payee_id: string;
  gig_id?: string;
  home_id?: string;
  // Amounts (in cents)
  amount_total: number;
  amount_subtotal?: number;
  amount_platform_fee?: number;
  amount_to_payee?: number;
  amount_processing_fee?: number;
  tip_amount?: number;
  currency: string;
  // Status
  payment_status: PaymentStatus;
  payment_type: PaymentType;
  // Stripe references
  stripe_payment_intent_id?: string;
  stripe_setup_intent_id?: string;
  stripe_charge_id?: string;
  stripe_transfer_id?: string;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  stripe_transfer_reversal_id?: string;
  tip_payment_intent_id?: string;
  // Payment method display info
  payment_method_type?: string;
  payment_method_last4?: string;
  payment_method_brand?: string;
  // Timestamps
  captured_at?: string;
  cooling_off_ends_at?: string;
  authorization_expires_at?: string;
  transfer_scheduled_at?: string;
  payment_succeeded_at?: string;
  // Flags
  off_session_auth_required?: boolean;
  is_escrowed?: boolean;
  // Refund
  refunded_amount?: number;
  refund_reason?: string;
  // Dispute
  dispute_id?: string;
  dispute_status?: string;
  dispute_evidence_submitted_at?: string;
  // Risk
  risk_band?: 'normal' | 'elevated' | 'high';
  // Failure info
  failure_code?: string;
  failure_message?: string;
  // Legacy compat
  amount?: number;
  status?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentStateInfo {
  label: string;
  color: string;
  description: string;
}

// ============ API RESPONSE TYPES ============

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============ FORM TYPES ============

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  /** Optional since the wedge slim signup — the backend auto-generates a
   *  handle when omitted. Native clients may still send one. */
  username?: string;
  name?: string;
  phone_number?: string;
  /** Pre-account funnel continuity id (see @pantopus/api funnel). */
  anon_id?: string;
}

export interface GigCreateForm {
  title: string;
  description: string;
  category: string;
  gig_type: 'one_time' | 'recurring' | 'urgent';
  location_type: 'in_person' | 'remote' | 'hybrid';
  address?: string;
  latitude?: number;
  longitude?: number;
  budget_min?: number;
  budget_max?: number;
  budget_type?: 'fixed' | 'hourly' | 'negotiable';
  deadline?: string;
  required_skills?: string[];
  estimated_duration?: string;
}

/**
 * Web MVP request shape for creating a gig (matches current backend + DB schema in backend/database/schema.sql)
 */
export interface GigCreateRequest {
  title: string;
  description: string;
  price: number;
  category?: string | null;
  deadline?: string | null;
  estimated_duration?: number | null;
  attachments?: string[];
  /** Post this gig on behalf of a business account (proxy posting) */
  beneficiary_user_id?: string | null;
  location: {
    mode: 'home' | 'address' | 'current';
    latitude: number;
    longitude: number;
    address: string;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    homeId?: string | null;
    place_id?: string | null;
  };
}

// ─── Magic Task Types ───────────────────────────────────────

export type ScheduleType = 'asap' | 'today' | 'scheduled' | 'flexible';
export type PayType = 'fixed' | 'hourly' | 'offers';
export type TaskSourceFlow = 'magic' | 'classic' | 'template' | 'context_shortcut';
export type PrivacyLevel = 'approx' | 'exact_after_accept' | 'exact_immediately';
export type LocationMode = 'home' | 'current' | 'address' | 'map_pin';
export type TaskArchetype =
  | 'quick_help'
  | 'delivery_errand'
  | 'home_service'
  | 'pro_service_quote'
  | 'care_task'
  | 'event_shift'
  | 'remote_task'
  | 'recurring_service'
  | 'general';

export interface MagicDraftRequest {
  text: string;
  context?: {
    homeId?: string | null;
    locationMode?: LocationMode;
    latitude?: number;
    longitude?: number;
    businessId?: string | null;
    budget?: number | null;
  };
  attachmentUrls?: string[];
}

export interface MagicDraftResponse {
  draft: MagicTaskDraft;
  confidence: number;
  fieldConfidence: Record<string, number>;
  clarifyingQuestion: ClarifyingQuestion | null;
  source: 'ai' | 'deterministic' | 'basic';
  elapsed: number;
  _fallback?: boolean;
}

export interface MagicTaskDraft {
  title: string;
  description: string;
  category: string;
  tags: string[];
  task_archetype?: TaskArchetype;
  pay_type: PayType;
  budget_fixed?: number | null;
  budget_range?: { min: number; max: number } | null;
  hourly_rate?: number | null;
  estimated_hours?: number | null;
  schedule_type: ScheduleType;
  time_window_start?: string | null;
  time_window_end?: string | null;
  location_mode: LocationMode;
  location_text?: string | null;
  privacy_level: PrivacyLevel;
  attachments_suggested?: boolean;
  is_urgent: boolean;
  attachments?: string[];
  items?: TaskItem[] | null;
  special_instructions?: string | null;
  access_notes?: string | null;
  required_tools?: string[];
  language_preference?: string | null;
  preferred_helper_id?: string | null;
  cancellation_policy?: string;
  pickup_address?: string | null;
  pickup_notes?: string | null;
  dropoff_address?: string | null;
  dropoff_notes?: string | null;
  delivery_proof_required?: boolean;
  requires_license?: boolean;
  license_type?: string | null;
  requires_insurance?: boolean;
  scope_description?: string | null;
  deposit_required?: boolean;
  deposit_amount?: number | null;
  care_details?: object | null;
  logistics_details?: object | null;
  remote_details?: object | null;
  event_details?: object | null;
  starts_asap?: boolean;
  response_window_minutes?: number | null;
  urgent_details?: object | null;
}

export interface ClarifyingQuestion {
  field: string;
  question: string;
  options: string[];
}

export interface TaskItem {
  name: string;
  notes?: string | null;
  budgetCap?: number | null;
  preferredStore?: string | null;
}

export interface MagicPostRequest {
  text: string;
  draft: MagicTaskDraft;
  location?: {
    mode?: 'home' | 'address' | 'current' | 'custom' | null;
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    homeId?: string | null;
    place_id?: string | null;
  } | null;
  beneficiary_user_id?: string | null;
  source_flow?: TaskSourceFlow;
  engagement_mode?: 'instant_accept' | 'curated_offers' | 'quotes' | null;
  task_archetype?: TaskArchetype;
  ai_confidence?: number | null;
  ai_draft_json?: Record<string, unknown> | null;
}

export interface MagicPostResponse {
  message: string;
  gig: {
    id: string;
    title: string;
    description: string;
    price: number;
    category: string;
    status: string;
    created_at: string;
    user_id: string;
    created_by: string;
    undo_expires_at: string;
    schedule_type: ScheduleType;
    pay_type: PayType;
    undo_window_ms: number;
    can_undo: boolean;
  };
  nearby_helpers?: number | null;
  notified_count?: number | null;
}

export interface SmartTemplate {
  id: string;
  label: string;
  icon: string;
  template: Partial<MagicTaskDraft>;
}

export interface SavedTaskTemplate {
  id: string;
  user_id: string;
  home_id?: string | null;
  label: string;
  template: Partial<MagicTaskDraft>;
  use_count: number;
  last_used?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MagicSettings {
  instant_post: boolean;
  post_count: number;
  suggest_instant: boolean;
}

/** Form state for the profile edit screen (all fields are controlled strings). */
export interface ProfileFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  bio: string;
  tagline: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  website: string;
  linkedin: string;
  twitter: string;
  instagram: string;
  facebook: string;
}

export interface ProfileUpdateForm {
  name?: string;
  username?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  bio?: string;
  tagline?: string;
  phone_number?: string;
  phoneNumber?: string;
  date_of_birth?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  website?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  profileVisibility?: 'public' | 'registered' | 'private';
  profile_visibility?: 'public' | 'registered' | 'private';
  showEmail?: boolean;
  show_email?: boolean;
  showPhone?: boolean;
  show_phone?: boolean;
  emailNotifications?: boolean;
  email_notifications?: boolean;
  pushNotifications?: boolean;
  push_notifications?: boolean;
  skills?: string[];
  interests?: string[];
  settings?: Record<string, any>;
}

// ============ FILTER/SEARCH TYPES ============

export interface GigFilters {
  category?: string;
  gig_type?: string[];
  location_type?: string[];
  budget_min?: number;
  budget_max?: number;
  /** Min price in dollars (inclusive) — mapped to backend minPrice */
  minPrice?: number;
  /** Max price in dollars (inclusive) — mapped to backend maxPrice */
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radius?: number; // in kilometers
  /** Radius in miles (1–100, default 25) — used by find_gigs_nearby_v2 */
  radiusMiles?: number;
  /** Include remote gigs with no location (default true) */
  includeRemote?: boolean;
  status?: string[];
  /** Convenience sort key */
  sort?:
    | 'newest'
    | 'oldest'
    | 'price_low'
    | 'price_high'
    | 'ending_soon'
    | 'distance'
    | 'best_match'
    | 'urgency'
    | 'quick';
  sort_by?: 'created_at' | 'budget' | 'distance' | 'deadline';
  sort_order?: 'asc' | 'desc';
  user_id?: string;
  userId?: string;
  /** Max distance in meters (requires lat/lng) — caps at 80467 (50 miles) */
  max_distance?: number;
  /** Deadline filter: tasks due within a timeframe */
  deadline?: 'today' | 'tomorrow' | 'this_week';
  /** Search query — forwarded to backend for title/description search */
  search?: string;
}

export interface HomeFilters {
  city?: string;
  state?: string;
  zip_code?: string;
  home_type?: string[];
  latitude?: number;
  longitude?: number;
  radius?: number;
}

// ============ WEBSOCKET/REALTIME TYPES ============

export interface SocketMessage {
  event: string;
  data: any;
  timestamp: string;
}

export interface TypingIndicator {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

// ============ ERROR TYPES ============

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
  details?: any;
}

export interface SimpleRegisterForm {
  email: string;
  password: string;
  username: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}

// ============================================================
// BUSINESS ADDRESS DECISION ENGINE TYPES
// ============================================================

export type BusinessLocationTypeEnum =
  | 'storefront'
  | 'office'
  | 'warehouse'
  | 'home_based_private'
  | 'service_area_only'
  | 'mailing_only'
  | 'unknown';

export type BusinessAddressDecisionStatus =
  | 'ok'
  | 'need_suite'
  | 'multiple_matches'
  | 'cmra_detected'
  | 'po_box'
  | 'place_mismatch'
  | 'undeliverable'
  | 'low_confidence'
  | 'conflict'
  | 'mixed_use'
  | 'high_risk'
  | 'service_error';

export type BusinessLocationVerificationTier =
  | 'bl0_none'
  | 'bl1_deliverable'
  | 'bl2_presence_light'
  | 'bl3_presence_strong'
  | 'bl4_managed';

export type BusinessIdentityVerificationTier =
  | 'bi0_unverified'
  | 'bi1_basic'
  | 'bi2_domain_social'
  | 'bi3_documented'
  | 'bi4_authority';

export type LocationIntent =
  | 'CUSTOMER_FACING'
  | 'OFFICE_NOT_PUBLIC'
  | 'WAREHOUSE'
  | 'HOME_BASED_PRIVATE'
  | 'SERVICE_AREA_ONLY'
  | 'MAILING_ONLY';

export interface BusinessAddressCapabilities {
  map_pin: boolean;
  show_in_nearby: boolean;
  receive_mail: boolean;
  enable_payouts: boolean;
}

export interface BusinessAddressDecision {
  status: BusinessAddressDecisionStatus;
  business_location_type: BusinessLocationTypeEnum;
  allowed_capabilities: BusinessAddressCapabilities;
  required_verification: string[];
  reasons: string[];
  manual_entry?: boolean;
}

export interface NormalizedBusinessAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  plus4: string;
}

export interface BusinessAddressVerdict {
  canonical_address_id: string | null;
  normalized: NormalizedBusinessAddress;
  coordinates: { lat: number; lng: number } | null;
  decision: BusinessAddressDecision;
  candidates: Array<{
    address: string;
    city: string;
    state: string;
    zipcode: string;
    place_id?: string;
  }>;
}

export interface ValidateBusinessAddressRequest {
  address: string;
  address2?: string;
  city: string;
  state?: string;
  zipcode?: string;
  country?: string;
  place_id?: string;
  location_intent?: LocationIntent;
  force_manual?: boolean;
}

export interface CreateBusinessLocationRequest {
  label?: string;
  address: string;
  address2?: string;
  city: string;
  state?: string;
  zipcode?: string;
  country?: string;
  is_primary?: boolean;
  phone?: string;
  email?: string;
  location_type?: BusinessLocationTypeEnum;
  is_customer_facing?: boolean;
  location_intent?: LocationIntent;
  service_area?: {
    radius_miles: number;
    center_lat: number;
    center_lng: number;
  };
}

export interface BusinessLocation {
  id: string;
  business_user_id: string;
  label: string;
  is_primary: boolean;
  address: string;
  address2?: string;
  city: string;
  state?: string;
  zipcode?: string;
  country: string;
  location?: { latitude: number; longitude: number } | null;
  timezone?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  sort_order: number;
}

export interface BusinessLocationEnhanced extends BusinessLocation {
  address_id?: string;
  address_hash?: string;
  location_type: BusinessLocationTypeEnum;
  location_verification_tier: BusinessLocationVerificationTier;
  is_customer_facing: boolean;
  decision_status?: BusinessAddressDecisionStatus;
  decision_reasons: string[];
  capabilities: BusinessAddressCapabilities;
  required_verification: string[];
  service_area?: {
    radius_miles: number;
    center_lat: number;
    center_lng: number;
  };
  verified_at?: string;
}

export interface BusinessMailingAddress {
  id: string;
  business_user_id: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_cmra: boolean;
  is_po_box: boolean;
  is_primary: boolean;
}

// Decision status → UI screen routing map (for frontend use)
export const DECISION_STATUS_BLOCKING: BusinessAddressDecisionStatus[] = [
  'need_suite',
  'undeliverable',
  'service_error',
];

export const DECISION_STATUS_MAILING_ONLY: BusinessAddressDecisionStatus[] = [
  'cmra_detected',
  'po_box',
];

export const DECISION_STATUS_EXTRA_VERIFICATION: BusinessAddressDecisionStatus[] = [
  'place_mismatch',
  'mixed_use',
  'high_risk',
];
