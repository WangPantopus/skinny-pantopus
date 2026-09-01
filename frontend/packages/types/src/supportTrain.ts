// ============================================================
// SUPPORT TRAIN TYPES
// Based on backend/database/migrations/112 + 113 and design doc
// Sections 19, 20, 22.
// ============================================================

// ─── Activity (parent entity) ───────────────────────────────

export type ActivityType = 'support_train';

export type ActivityStatus = 'draft' | 'published' | 'active' | 'paused' | 'completed' | 'archived';

export interface Activity {
  id: string;
  creator_user_id: string;
  activity_type: ActivityType;
  status: ActivityStatus;
  title?: string | null;
  summary?: string | null;
  visibility?: string | null;
  cover_media_url?: string | null;
  location_id?: string | null;
  home_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
  chat_thread_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Support Train ──────────────────────────────────────────

export type SupportTrainType = 'meal_support';

export type SupportTrainStatus =
  | 'draft'
  | 'published'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived';

export type SharingMode = 'private_link' | 'invited_only' | 'direct_share_only';

export interface SupportTrain {
  id: string;
  activity_id: string;
  support_train_type: SupportTrainType;
  organizer_user_id: string;
  recipient_user_id?: string | null;
  recipient_home_id?: string | null;
  story?: string | null;
  status: SupportTrainStatus;
  sharing_mode: SharingMode;
  show_exact_address_after_signup: boolean;
  enable_home_cooked_meals: boolean;
  enable_takeout: boolean;
  enable_groceries: boolean;
  enable_gift_funds: boolean;
  ai_draft_payload?: Record<string, unknown> | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Recipient profile ──────────────────────────────────────

export interface SupportTrainRecipientProfile {
  id: string;
  support_train_id: string;
  household_size?: number | null;
  adults_count?: number | null;
  children_count?: number | null;
  preferred_dropoff_start_time?: string | null;
  preferred_dropoff_end_time?: string | null;
  contactless_preferred: boolean;
  delivery_instructions?: string | null;
  dietary_styles: Record<string, unknown>;
  allergies: Record<string, unknown>;
  favorite_meals: Record<string, unknown>;
  least_favorite_meals: Record<string, unknown>;
  favorite_restaurants: Record<string, unknown>;
  special_instructions?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Organizer ──────────────────────────────────────────────

export type OrganizerRole = 'primary' | 'co_organizer' | 'recipient_delegate';

export interface SupportTrainOrganizer {
  id: string;
  support_train_id: string;
  user_id: string;
  role: OrganizerRole;
  created_at: string;
}

// ─── Slot ───────────────────────────────────────────────────

export type SlotLabel = 'Breakfast' | 'Lunch' | 'Dinner' | 'Groceries' | 'Custom';

export type SupportMode = 'meal' | 'takeout' | 'groceries';

export type SlotStatus = 'open' | 'full' | 'canceled' | 'completed';

export interface SupportTrainSlot {
  id: string;
  support_train_id: string;
  slot_date: string;
  slot_label: SlotLabel;
  support_mode: SupportMode;
  start_time?: string | null;
  end_time?: string | null;
  capacity: number;
  filled_count: number;
  status: SlotStatus;
  notes?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ─── Reservation ────────────────────────────────────────────

export type ReservationStatus = 'reserved' | 'canceled' | 'delivered' | 'confirmed';

export type ContributionMode = 'cook' | 'takeout' | 'groceries';

export interface SupportTrainReservation {
  id: string;
  slot_id: string;
  support_train_id: string;
  user_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  status: ReservationStatus;
  contribution_mode: ContributionMode;
  dish_title?: string | null;
  restaurant_name?: string | null;
  estimated_arrival_at?: string | null;
  note_to_recipient?: string | null;
  private_note_to_organizer?: string | null;
  guest_address_shared_at?: string | null;
  guest_address_shared_by?: string | null;
  guest_address_share_count?: number;
  created_at: string;
  updated_at: string;
  canceled_at?: string | null;
  exact_address_shared?: boolean;
}

// ─── Fund ───────────────────────────────────────────────────

export type FundStatus = 'enabled' | 'disabled' | 'closed';

export interface SupportTrainFund {
  id: string;
  support_train_id: string;
  currency: string;
  goal_amount?: number | null;
  total_amount: number;
  status: FundStatus;
  created_at: string;
  updated_at: string;
}

// ─── Fund contribution ──────────────────────────────────────

export type ContributionPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface SupportTrainFundContribution {
  id: string;
  support_train_fund_id: string;
  contributor_user_id?: string | null;
  amount: number;
  currency: string;
  note?: string | null;
  is_anonymous: boolean;
  payment_status: ContributionPaymentStatus;
  created_at: string;
}

// ─── Update ─────────────────────────────────────────────────

export interface SupportTrainUpdate {
  id: string;
  support_train_id: string;
  author_user_id: string;
  body: string;
  media_urls?: string[] | null;
  created_at: string;
}

// ─── Invite ─────────────────────────────────────────────────

export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface SupportTrainInvite {
  id: string;
  support_train_id: string;
  invited_by_user_id: string;
  invitee_user_id?: string | null;
  invitee_email?: string | null;
  invite_token: string;
  status: InviteStatus;
  created_at: string;
  accepted_at?: string | null;
}

// ─── API request / response types (Section 22) ─────────────

/** POST /activities/support-trains/draft-from-story */
export interface DraftFromStoryRequest {
  story: string;
  support_modes_requested?: SupportMode[];
  recipient_reference?: string | null;
  home_reference?: string | null;
}

export interface DraftFromStoryResponse {
  draft: Partial<SupportTrain> & {
    recipient_profile?: Partial<SupportTrainRecipientProfile>;
    suggested_slots?: Array<{
      slot_date: string;
      slot_label: SlotLabel;
      support_mode: SupportMode;
      start_time?: string | null;
      end_time?: string | null;
    }>;
  };
  missing_required_fields: string[];
  summary_chips: string[];
}

/** POST /activities/support-trains — drop-off coordinates (resolves to Home on server) */
export interface SupportTrainDeliveryLocation {
  mode: 'home' | 'current' | 'address';
  latitude: number;
  longitude: number;
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  home_id?: string | null;
  place_id?: string | null;
}

/** POST /activities/support-trains */
export interface CreateSupportTrainRequest {
  title: string;
  story?: string | null;
  support_train_type?: SupportTrainType;
  recipient_user_id?: string | null;
  recipient_home_id?: string | null;
  sharing_mode?: SharingMode;
  show_exact_address_after_signup?: boolean;
  enable_home_cooked_meals?: boolean;
  enable_takeout?: boolean;
  enable_groceries?: boolean;
  enable_gift_funds?: boolean;
  home_id?: string | null;
  timezone?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  recipient_profile?: Partial<SupportTrainRecipientProfile>;
  draft_payload?: Record<string, unknown> | null;
  delivery_location?: SupportTrainDeliveryLocation | null;
}

/** PATCH /activities/support-trains/:id */
export interface UpdateSupportTrainRequest {
  title?: string;
  story?: string | null;
  sharing_mode?: SharingMode;
  show_exact_address_after_signup?: boolean;
  enable_home_cooked_meals?: boolean;
  enable_takeout?: boolean;
  enable_groceries?: boolean;
  enable_gift_funds?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
  /** Maps to Activity.visibility — neighborhood Tasks feed lists nearby/public only */
  activity_visibility?: 'private' | 'nearby' | 'public';
}

/** GET /activities/support-trains/nearby */
export interface NearbySupportTrainListItem {
  support_train_id: string;
  activity_id: string;
  title: string | null;
  status: string;
  published_at: string | null;
  distance_meters: number;
  open_slots_count: number;
  city: string | null;
  state: string | null;
}

/** POST /activities/support-trains/:id/generate-slots */
export type GenerateSlotsPreset =
  | 'every_dinner'
  | 'mwf_dinners'
  | 'every_lunch'
  | 'weekly_groceries';

export interface GenerateSlotsRequest {
  preset: GenerateSlotsPreset;
  start_date: string;
  end_date: string;
  replace_existing?: boolean;
  /** 0=Sun … 6=Sat; omit to use preset default (e.g. all days or M/W/F) */
  weekdays?: number[];
  start_time?: string | null;
  end_time?: string | null;
  slot_label?: SlotLabel;
  support_mode?: SupportMode;
}

/** POST /activities/support-trains/:id/slots/:slotId/reserve */
export interface ReserveSlotRequest {
  contribution_mode: ContributionMode;
  dish_title?: string | null;
  restaurant_name?: string | null;
  estimated_arrival_at?: string | null;
  note_to_recipient?: string | null;
  private_note_to_organizer?: string | null;
}

/** POST /activities/support-trains/:id/reservations/:reservationId/cancel */
export interface CancelReservationRequest {
  organizer_reason?: string | null;
  helper_reason?: string | null;
}

/** POST /activities/support-trains/:id/reservations/:reservationId/reveal-address */
export interface RevealSupportTrainAddressResponse {
  shared: boolean;
  already_shared: boolean;
  helper_user_id?: string;
  guest_email?: string;
  guest_address_shared_at?: string;
  reservation_id: string;
}
