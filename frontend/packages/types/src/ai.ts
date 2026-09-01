// ============================================================
// AI AGENT TYPES
// Types for the Pantopus AI assistant layer
// ============================================================

// ─── Draft types ─────────────────────────────────────────────

export interface GigDraft {
  title: string;
  description: string;
  price?: number;
  category?: string;
  is_urgent?: boolean;
  tags?: string[];
  schedule_type?: 'asap' | 'today' | 'scheduled' | 'flexible';
  pay_type?: 'fixed' | 'hourly' | 'offers';
  estimated_duration?: number;
  cancellation_policy?: 'flexible' | 'standard' | 'strict';
  special_instructions?: string;
  access_notes?: string;
  required_tools?: string;
  location_preferences?: {
    visibility_scope?: 'neighborhood' | 'city' | 'radius' | 'global';
    location_precision?: 'exact_place' | 'approx_area' | 'neighborhood_only' | 'none';
    reveal_policy?: 'public' | 'after_interest' | 'after_assignment' | 'never_public';
  };
  clarifying_questions?: ClarifyingQuestionAI[];
}

export interface ListingDraft {
  title: string;
  description?: string;
  price?: number | null;
  isFree?: boolean;
  category?: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'for_parts' | null;
  tags?: string[];
  listingType: string;
  deliveryAvailable?: boolean;
  meetupPreference?: 'porch_pickup' | 'public_meetup' | 'flexible' | null;
  budgetMax?: number | null;
  visibilityScope?: string;
  locationPrecision?: string;
  clarifying_questions?: ClarifyingQuestionAI[];
}

export interface PostDraft {
  content: string;
  title?: string | null;
  postType?: string;
  purpose?: string;
  visibility?: string;
  tags?: string[];
  eventDate?: string | null;
  eventEndDate?: string | null;
  eventVenue?: string | null;
  safetyAlertKind?: string | null;
  lostFoundType?: 'lost' | 'found' | null;
  dealExpiresAt?: string | null;
  clarifying_questions?: ClarifyingQuestionAI[];
}

export interface ClarifyingQuestionAI {
  id: string;
  question: string;
}

// ─── Mail Summary ────────────────────────────────────────────

export interface MailKeyFact {
  field: string;
  value: string;
}

export interface MailRecommendedAction {
  type: 'pay' | 'remind' | 'file' | 'create_task' | 'acknowledge' | 'dispute' | 'share_household' | 'forward';
  title: string;
  reason?: string;
  metadata?: {
    amount?: number;
    due_date?: string;
    folder?: string;
  };
}

export interface MailSummary {
  summary: string;
  key_facts: MailKeyFact[];
  recommended_actions: MailRecommendedAction[];
  urgency: 'none' | 'due_soon' | 'overdue' | 'time_sensitive';
}

// ─── Place Brief ─────────────────────────────────────────────

export interface PlaceBriefHeadline {
  type: 'weather' | 'traffic' | 'civic' | 'utility';
  title: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  detail?: string | null;
  action?: string | null;
}

export interface PlaceBriefSource {
  provider: string;
  updated_at: string;
}

export interface PlaceBrief {
  place: {
    label: string;
    city: string;
    state: string;
  };
  summary: string;
  headlines: PlaceBriefHeadline[];
  overall_status: 'all_clear' | 'advisory' | 'warning' | 'critical';
  sources: PlaceBriefSource[];
}

// ─── Neighborhood Pulse ─────────────────────────────────

export interface PulseSignalAction {
  type: 'create_gig' | 'view' | 'invite';
  label: string;
  route: string;
}

export interface PulseSignal {
  signal_type: 'air_quality' | 'weather' | 'seasonal_suggestion' | 'community' | 'local_services';
  priority: number;
  title: string;
  detail: string;
  icon: string;
  color: string;
  actions?: PulseSignalAction[];
}

export interface PulseProperty {
  year_built: number | null;
  sqft: number | null;
  estimated_value: number | null;
  zip_median_value: number | null;
  property_type: string | null;
}

export interface PulseNeighborhood {
  median_home_value: number | null;
  median_household_income: number | null;
  median_year_built: number | null;
  walk_score: number | null;
  walk_description: string | null;
  transit_score: number | null;
  bike_score: number | null;
  flood_zone: string | null;
  flood_zone_description: string | null;
}

export interface SeasonalContext {
  season: string;
  tip: string | null;
  first_action_nudge: {
    prompt: string;
    route: string;
    gig_category?: string | null;
    gig_title?: string | null;
  } | null;
}

export interface CommunityDensity {
  neighbor_count: number;
  density_message: string;
  invite_cta: boolean;
}

export interface PulseSource {
  provider: string;
  updated_at: string;
}

export interface PulseMeta {
  community_signals_count: number;
  external_signals_count: number;
  partial_failures: string[];
  computed_at: string;
}

export interface NeighborhoodPulse {
  pulse: {
    greeting: string;
    summary: string;
    overall_status: 'active' | 'quiet' | 'advisory' | 'alert';
    property: PulseProperty | null;
    neighborhood: PulseNeighborhood | null;
    signals: PulseSignal[];
    seasonal_context: SeasonalContext;
    community_density: CommunityDensity;
    sources: PulseSource[];
    meta: PulseMeta;
  };
}

// ─── AI Chat ─────────────────────────────────────────────────

export type AIDraftType = 'gig' | 'listing' | 'post' | 'mail_summary';

export interface AIChatDraft {
  type: AIDraftType;
  draft: GigDraft | ListingDraft | PostDraft | MailSummary;
  valid: boolean;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
  drafts?: AIChatDraft[];
  timestamp: string;
}

export interface AIConversation {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── SSE Stream Events ──────────────────────────────────────

export type AIStreamEvent =
  | { type: 'conversation'; conversationId: string; isNew: boolean }
  | { type: 'text_delta'; delta: string }
  | { type: 'draft'; draftType: AIDraftType; draft: unknown; valid: boolean }
  | { type: 'error'; error: string; message: string }
  | { type: 'done'; conversationId: string; usage: { inputTokens: number; outputTokens: number }; toolCalls: number }
  | { type: 'close' };

// ─── API Request/Response types ─────────────────────────────

export interface AIChatRequest {
  message: string;
  conversationId?: string;
  coarseLocation?: { city?: string; state?: string };
  images?: string[];
}

export interface AIDraftGigRequest {
  text: string;
  coarseLocation?: { city?: string; state?: string };
  context?: {
    budgetHint?: string;
    timeHint?: string;
    category?: string;
  };
}

export interface AIDraftGigResponse {
  draft: GigDraft;
  clarifying_questions: ClarifyingQuestionAI[];
}

export interface AIDraftListingRequest {
  text: string;
  coarseLocation?: { city?: string; state?: string };
  context?: {
    listingType?: string;
    category?: string;
    existingTitle?: string;
  };
}

export interface AIDraftListingResponse {
  draft: ListingDraft;
  clarifying_questions: ClarifyingQuestionAI[];
}

export interface AIDraftPostRequest {
  text: string;
  surface?: 'place' | 'connections';
  coarseLocation?: { city?: string; state?: string };
  context?: {
    postType?: string;
    existingContent?: string;
  };
}

export interface AIDraftPostResponse {
  draft: PostDraft;
  clarifying_questions: ClarifyingQuestionAI[];
}

export interface AISummarizeMailRequest {
  mailItemId: string;
}

// ─── Hub Today Card ─────────────────────────────────────────

export interface HubTodayLocation {
  label: string;
  source: 'custom' | 'viewing_pinned' | 'primary_home' | 'home' | 'viewing_recent' | 'none';
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  confidence: number;
}

export interface HubTodayWeather {
  current_temp_f: number | null;
  condition_code: string;
  condition_label: string;
  high_f: number | null;
  low_f: number | null;
  precipitation_next_6h: boolean;
  precipitation_start_at: string | null;
}

export interface HubTodayAQI {
  index: number;
  category: string;
  is_noteworthy: boolean;
}

export interface HubTodayAlert {
  id: string;
  severity: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

export interface HubTodaySignal {
  kind: 'alert' | 'weather' | 'aqi' | 'precipitation' | 'temperature' | 'bill_due' | 'task_due' | 'calendar' | 'mail' | 'gig' | 'seasonal' | 'local_update';
  score: number;
  label: string;
  detail: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  action: { label: string; route: string } | null;
  data: Record<string, any>;
}

export interface HubTodayAction {
  label: string;
  route: string;
}

export interface HubTodayMeta {
  providers_used: string[];
  partial_failures: string[];
  cache_hits: number;
  total_latency_ms: number;
}

export interface HubToday {
  location: HubTodayLocation;
  summary: string;
  display_mode: 'full' | 'reduced' | 'minimal' | 'hidden';
  weather: HubTodayWeather | null;
  aqi: HubTodayAQI | null;
  alerts: HubTodayAlert[];
  signals: HubTodaySignal[];
  seasonal: { season: string; tip: string | null } | null;
  actions: HubTodayAction[];
  fetched_at: string;
  expires_at: string;
  meta: HubTodayMeta;
}

// ─── Notification Preferences ───────────────────────────────

export interface UserNotificationPreferences {
  id?: string;
  user_id: string;
  daily_briefing_enabled: boolean;
  daily_briefing_time_local: string;
  daily_briefing_timezone: string;
  evening_briefing_enabled: boolean;
  evening_briefing_time_local: string;
  weather_alerts_enabled: boolean;
  aqi_alerts_enabled: boolean;
  mail_summary_enabled: boolean;
  gig_updates_enabled: boolean;
  home_reminders_enabled: boolean;
  quiet_hours_start_local: string | null;
  quiet_hours_end_local: string | null;
  location_mode: 'viewing_location' | 'primary_home' | 'device_location' | 'custom';
  custom_latitude: number | null;
  custom_longitude: number | null;
  custom_label: string | null;
  created_at?: string;
  updated_at?: string;
}
