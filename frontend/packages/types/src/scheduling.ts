// ============================================================
// CALENDARLY SCHEDULING TYPES
// Shared contract for the Calendarly scheduling feature (web + mobile).
// Generated from the backend route handlers + Joi schemas on
// `feature/calendarly` (migrations 159–165). See
// reference/calendarly-backend-api.md for the authoritative shapes.
//
// NOTE: `Assignment` is already exported by ./gig, so the scheduling
// assignment config is named `EventTypeAssignment` to avoid a duplicate
// barrel export.
// ============================================================

// ─── Owner context ──────────────────────────────────────────
// On /api/scheduling/* the caller declares whose schedule they mean.
//   personal → omit owner fields (signed-in user)
//   business → owner_type:'business' + owner_id:<business_user_id>
//   home     → call the /api/homes/:homeId/scheduling/* alias
// The api layer + SchedulingOwner helper inject this into every call.

export type SchedulingOwnerType = "user" | "business" | "home";

export interface SchedulingOwnerRef {
  ownerType: SchedulingOwnerType;
  /** business_user_id when ownerType==='business' */
  ownerId?: string | null;
  /** home id when ownerType==='home' (routes to /api/homes/:homeId/scheduling) */
  homeId?: string | null;
}

// ─── Booking page ───────────────────────────────────────────

export type BookingPageVisibility = "listed" | "unlisted";

/** First-class public page/link states (rendered by the W0 state views). */
export type SchedulingPageState =
  | "active"
  | "paused"
  | "secret"
  | "expired"
  | "unavailable";

export type RefundPolicy = "full" | "partial" | "none" | "deposit_only";

/** Cancellation/refund policy object stored on the booking page (flexible). */
export interface CancellationPolicy {
  /** Minutes before start when free cancellation closes. */
  cutoff_min?: number | null;
  /** Minutes before start when rescheduling closes. */
  reschedule_cutoff_min?: number | null;
  refund_policy?: RefundPolicy;
  notes?: string | null;
  [key: string]: unknown;
}

/**
 * `cancellation_policy` as stored on the wire (jsonb since migration 166):
 * either the structured object above, or a plain string — the iOS presets
 * 'flexible' | 'moderate' | 'strict', or a free-text blurb. Consumers must
 * tolerate both shapes.
 */
export type CancellationPolicyValue = CancellationPolicy | string;

export interface BookingPage {
  id: string;
  owner_type: SchedulingOwnerType;
  owner_id: string;
  slug: string;
  is_live: boolean;
  is_paused: boolean;
  title: string | null;
  tagline: string | null;
  avatar_url: string | null;
  intro: string | null;
  confirmation_message: string | null;
  timezone: string | null;
  reminder_minutes: number[];
  cancellation_policy: CancellationPolicyValue | null;
  visibility: BookingPageVisibility;
  branding: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

/** Body for PUT /booking-page (all optional, partial update). */
export interface BookingPageInput {
  title?: string;
  tagline?: string | null;
  avatar_url?: string | null;
  intro?: string | null;
  confirmation_message?: string | null;
  timezone?: string;
  is_live?: boolean;
  is_paused?: boolean;
  reminder_minutes?: number[];
  cancellation_policy?: CancellationPolicyValue | null;
  visibility?: BookingPageVisibility;
  branding?: Record<string, unknown>;
}

/** GET /booking-page/check-slug response. */
export interface SlugCheckResult {
  available: boolean;
  suggestions: string[];
  error?: string;
  message?: string;
}

// ─── Event types ────────────────────────────────────────────

export type EventTypeLocationMode =
  | "video"
  | "phone"
  | "in_person"
  | "custom"
  | "ask";

export type AssignmentMode =
  | "one_on_one"
  | "collective"
  | "round_robin"
  | "group";

export type EventTypeVisibility = "public" | "secret";

export type IntakeQuestionFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "checkbox"
  | "phone";

/** Location config slice of an event type. */
export interface EventTypeLocation {
  location_mode: EventTypeLocationMode;
  location_detail: string | null;
}

/** Pricing/refund config slice of an event type (paid surfaces gated by flag). */
export interface EventTypePricing {
  price_cents: number;
  currency: string;
  deposit_cents: number;
  deposit_refundable: boolean;
  no_show_fee_cents: number;
  refund_policy: RefundPolicy;
}

export interface EventType extends EventTypeLocation, EventTypePricing {
  id: string;
  page_id?: string | null;
  owner_type: SchedulingOwnerType;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  durations: number[];
  default_duration: number;
  assignment_mode: AssignmentMode;
  requires_approval: boolean;
  visibility: EventTypeVisibility;
  buffer_before_min: number;
  buffer_after_min: number;
  min_notice_min: number;
  max_horizon_days: number;
  slot_interval_min: number;
  daily_cap: number | null;
  per_booker_cap: number | null;
  seat_cap: number;
  cancellation_window_min: number | null;
  reschedule_cutoff_min: number | null;
  allow_invitee_cancel: boolean;
  allow_invitee_reschedule: boolean;
  schedule_id: string | null;
  is_active: boolean;
  sort_order?: number | null;
  /** Active assignee count, aggregated by GET /event-types for the list's
   *  "N hosts" pill (design event-types-frames.jsx EventRow). Absent on
   *  single-row responses. */
  assignee_count?: number;
  created_at: string;
  updated_at: string;
}

/** Intake question (a.k.a. EventTypeQuestion). */
export interface IntakeQuestion {
  id?: string;
  event_type_id?: string;
  label: string;
  field_type: IntakeQuestionFieldType;
  options: string[];
  required: boolean;
  sort_order: number;
}

export type AssigneeSubjectType = "user" | "business_team";

/** A single assignee row on an event type. */
export interface EventTypeAssignee {
  id?: string;
  event_type_id?: string;
  subject_id: string;
  subject_type: AssigneeSubjectType;
  weight: number;
  priority: number;
  is_active: boolean;
}

/** Round-robin / collective assignment config (named to avoid the gig `Assignment`). */
export interface EventTypeAssignment {
  assignment_mode: AssignmentMode;
  assignees: EventTypeAssignee[];
}

/** GET /event-types/:id response. */
export interface EventTypeDetail {
  eventType: EventType;
  assignees: EventTypeAssignee[];
  questions: IntakeQuestion[];
}

/** Body for POST /event-types (create). PUT uses Partial<EventTypeInput>. */
export interface EventTypeInput {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  durations?: number[];
  default_duration?: number;
  location_mode?: EventTypeLocationMode;
  location_detail?: string;
  assignment_mode?: AssignmentMode;
  requires_approval?: boolean;
  visibility?: EventTypeVisibility;
  buffer_before_min?: number;
  buffer_after_min?: number;
  min_notice_min?: number;
  max_horizon_days?: number;
  slot_interval_min?: number;
  daily_cap?: number | null;
  per_booker_cap?: number | null;
  seat_cap?: number;
  price_cents?: number;
  currency?: string;
  deposit_cents?: number;
  deposit_refundable?: boolean;
  cancellation_window_min?: number;
  reschedule_cutoff_min?: number;
  no_show_fee_cents?: number;
  refund_policy?: RefundPolicy;
  allow_invitee_cancel?: boolean;
  allow_invitee_reschedule?: boolean;
  schedule_id?: string | null;
  is_active?: boolean;
  /** Catalog position (reorder mode persists PUT /event-types/:id {sort_order}). */
  sort_order?: number;
}

// ─── Availability ───────────────────────────────────────────

export interface AvailabilitySchedule {
  id: string;
  user_id: string;
  name: string;
  timezone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Weekday slot rule. weekday: 0=Sunday … 6=Saturday; times 'HH:MM[:SS]'. */
export interface AvailabilityRule {
  id?: string;
  schedule_id?: string;
  weekday: number;
  start_time: string;
  end_time: string;
}
/** Alias used by the weekly-hours editor (W3). */
export type WeeklyHours = AvailabilityRule;

/** Date-level override. is_unavailable=true → blocked all day. */
export interface AvailabilityOverride {
  id?: string;
  schedule_id?: string;
  date: string;
  is_unavailable: boolean;
  start_time?: string | null;
  end_time?: string | null;
}
/** Alias used by the date-overrides editor (W3). */
export type DateOverride = AvailabilityOverride;

/** Time-block (vacation, lunch, etc.). */
export interface AvailabilityBlock {
  id: string;
  user_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  recurrence_rule: string | null;
  created_at: string;
}

/** GET /availability response bundle. */
export interface AvailabilityBundle {
  schedules: AvailabilitySchedule[];
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
}

/** Booking caps — these persist on the EVENT TYPE (B7 is a thin surface). */
export interface BookingLimits {
  daily_cap: number | null;
  per_booker_cap: number | null;
  seat_cap: number;
}

/** Notice / buffer / horizon rules — also persist on the EVENT TYPE. */
export interface NoticeRules {
  min_notice_min: number;
  max_horizon_days: number;
  buffer_before_min: number;
  buffer_after_min: number;
  slot_interval_min: number;
}

// ─── Notification preferences ───────────────────────────────
// Flexible object — round-trip unknown keys (object.unknown(true)).

export interface NotificationPreferences {
  reminder_minutes?: number[];
  [key: string]: unknown;
}

// ─── Bookings ───────────────────────────────────────────────

/**
 * Matches the Postgres Booking.status enum (migration 159). There is NO
 * 'rescheduled' status — a reschedule keeps the booking 'confirmed' and marks
 * it via `previous_start_at != null`.
 */
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "no_show";

/**
 * How a booking was created — matches the DB check constraint
 * Booking_created_via_chk (migration 160). Public-link bookings write
 * 'public_link', resource + in-app host bookings 'in_app', recurring series
 * 'manual', one-off links 'one_off'.
 */
export type BookingSource = "public_link" | "in_app" | "manual" | "one_off";

export type RsvpStatus = "going" | "maybe" | "declined" | "pending";

export interface Invitee {
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_user_id: string | null;
  invitee_timezone: string | null;
  invitee_phone?: string | null;
}

/** A single answer to an intake question. */
export interface BookingAnswer {
  label?: string;
  field_type?: IntakeQuestionFieldType;
  value: string | string[] | boolean | null;
}

export interface Booking extends Invitee {
  id: string;
  owner_type: SchedulingOwnerType;
  owner_id: string;
  event_type_id: string | null;
  host_user_id?: string | null;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  intake_answers?: Record<string, unknown> | null;
  payment_id?: string | null;
  package_credit_id?: string | null;
  created_via?: BookingSource;
  previous_start_at?: string | null;
  cancel_reason?: string | null;
  refund_issued?: boolean | null;
  no_show_fee_applied?: boolean | null;
  policy_snapshot?: Record<string, unknown> | null;
  requires_approval?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingAttendee {
  id: string;
  booking_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  rsvp_status: RsvpStatus;
  updated_at?: string;
}

/** GET /bookings/:id response. */
export interface BookingDetail {
  booking: Booking;
  attendees: BookingAttendee[];
  eventType: Pick<EventType, "id" | "name" | "location_mode"> | null;
}

/**
 * GET /bookings/summary — drives the A5 summary card.
 * Exact payload of bookingMetricsService.getSummary.
 */
export interface BookingsSummary {
  /** Bookings created this calendar month (pending/confirmed/completed/no-show). */
  bookingsThisMonth: number;
  /** Same tally for the previous calendar month. */
  bookingsLastMonth: number;
  /** Month-over-month change, integer percent (100 when last month was 0 but this month isn't). */
  deltaPct: number;
  /** Confirmed bookings with a future start. */
  upcomingCount: number;
  /** No-shows with start_at in this calendar month. */
  noShowCount: number;
  /** Daily created-booking counts for the trailing 30 days, oldest first. */
  sparkline: Array<{ date: string; count: number }>;
  /** Created-booking counts per event type over the same window, descending. */
  byEventType: Array<{ event_type_id: string; count: number }>;
}

/** Body for POST /bookings (manual host create). */
export interface BookingCreateInput {
  event_type_id: string;
  start_at: string;
  duration_min?: number;
  invitee_name?: string;
  invitee_email?: string;
  invitee_phone?: string;
  invitee_timezone?: string;
  intake_answers?: Record<string, unknown>;
}

// ─── Slots & conflicts ──────────────────────────────────────

export interface BookingSlot {
  start: string;
  end: string;
  startLocal: string;
  /** Internal host eligibility (host-side reads only). */
  eligibleHosts?: string[];
}

export type SlotConflictCode = "SLOT_TAKEN" | "SLOT_UNAVAILABLE" | "SLOT_FULL";

/** 409 conflict body — surfaced via SlotConflictAlternatives, never a dead end. */
export interface SlotConflict {
  error: SlotConflictCode;
  message?: string;
  alternatives: BookingSlot[];
}

// ─── One-off links ──────────────────────────────────────────

/** POST /booking-page/one-off-links response. */
export interface OneOffLink {
  token: string;
  path: string;
  expires_at: string;
  single_use: boolean;
}

export interface OneOffLinkInput {
  event_type_id: string;
  expires_in_min?: number;
  single_use?: boolean;
  offered_slots?: Array<{ start: string; end: string }>;
}

// ─── Public booking flow ────────────────────────────────────

/** publicEventTypeView returned by the public endpoints. */
export interface PublicEventType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  durations: number[];
  default_duration: number;
  location_mode: EventTypeLocationMode;
  location_detail: string | null;
  price_cents: number;
  currency: string;
  deposit_cents: number;
  deposit_refundable: boolean;
  refund_policy: RefundPolicy;
  cancellation_window_min: number | null;
  reschedule_cutoff_min: number | null;
  requires_approval: boolean;
}

/** publicPageView returned by GET /public/book/:slug. */
export interface PublicPageView {
  slug: string;
  title: string | null;
  tagline: string | null;
  avatar_url: string | null;
  intro: string | null;
  timezone: string | null;
  branding: Record<string, unknown> | null;
  owner_type: SchedulingOwnerType;
  cancellation_policy: CancellationPolicyValue | null;
}

/** GET /public/book/:slug response. */
export interface PublicBookingPage {
  page: PublicPageView;
  status: SchedulingPageState;
  eventTypes: PublicEventType[];
  /** Present on 404/unavailable. */
  error?: string;
  message?: string;
}

/** GET /public/book/:slug/:eventTypeSlug/slots response. */
export interface PublicSlotsResponse {
  eventType: PublicEventType;
  timezone: string;
  status: SchedulingPageState;
  slots: BookingSlot[];
}

/** GET /public/book/o/:token response. */
export interface PublicOneOff {
  eventType: PublicEventType;
  single_use: boolean;
  slots: BookingSlot[];
  status?: SchedulingPageState;
  error?: string;
  message?: string;
}

/** Body for POST /public/book/:slug/:eventTypeSlug (and the one-off variant). */
export interface PublicBookingInput {
  start_at: string;
  duration_min?: number;
  name: string;
  email: string;
  phone?: string | null;
  timezone?: string | null;
  answers?: Record<string, unknown>;
}

/**
 * Trimmed booking returned by the PUBLIC endpoints — the backend hand-builds
 * these payloads and never exposes the full Booking row to invitees (no
 * owner/invitee-contact/payment fields).
 */
export type PublicBookingSummary = Pick<
  Booking,
  "id" | "status" | "start_at" | "end_at"
> & {
  /** POST /public/book/:slug/:eventTypeSlug only — true when status is 'pending'. */
  requires_approval?: boolean;
  /** Cancellation/refund terms frozen at booking time (null when none). */
  policy_snapshot?: Record<string, unknown> | null;
};

/**
 * Trimmed booking on GET /public/booking/:token (manage view) — everything in
 * PublicBookingSummary plus the fields the manage screens render. This is the
 * ONLY public payload carrying location + reschedule/cancel context.
 */
export type ManageBookingRow = PublicBookingSummary &
  Pick<
    Booking,
    "invitee_name" | "invitee_timezone" | "previous_start_at" | "cancel_reason"
  > & {
    location_mode: EventTypeLocationMode | null;
    location_detail: string | null;
  };

/** POST /public/book/... success body. Persist `manageToken`. */
export interface CreatePublicBookingResult {
  booking: PublicBookingSummary;
  eventType: PublicEventType;
  page?: { confirmation_message: string | null; timezone: string | null };
  manageToken: string;
  clientSecret: string | null;
}

/** Computed actions on GET /public/booking/:token. */
export interface BookingManageActions {
  can_cancel: boolean;
  can_reschedule: boolean;
  invitee_cancel_allowed: boolean;
  invitee_reschedule_allowed: boolean;
  reschedule_deadline?: string | null;
  free_cancel_until?: string | null;
  refund_estimate_cents?: number | null;
}

export interface BookingPayment {
  amount_total: number;
  currency: string;
  payment_status: string;
  paid_at: string | null;
}

/** GET /public/booking/:token response (manage view). */
export interface BookingManageView {
  booking: ManageBookingRow;
  actions: BookingManageActions;
  payment: BookingPayment | null;
  eventType: PublicEventType | null;
  page:
    | (PublicPageView & { cancellation_policy: CancellationPolicyValue | null })
    | null;
}

export interface PublicWaitlistInput {
  name?: string | null;
  email: string;
  desired_from?: string | null;
  desired_to?: string | null;
}

// ─── Workflows & templates ──────────────────────────────────

export type WorkflowTrigger =
  | "booking_created"
  | "cancelled"
  | "rescheduled"
  | "before_start"
  | "after_end";

export type MessageChannel = "email" | "push" | "in_app" | "sms";
/** Workflow action shares the channel enum. */
export type WorkflowAction = MessageChannel;

export interface Workflow {
  id: string;
  owner_type: SchedulingOwnerType;
  owner_id: string;
  event_type_id: string | null;
  name: string;
  trigger: WorkflowTrigger;
  offset_minutes: number;
  action: WorkflowAction;
  message_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInput {
  event_type_id?: string | null;
  name: string;
  trigger: WorkflowTrigger;
  offset_minutes?: number;
  action: WorkflowAction;
  message_template?: string;
  is_active?: boolean;
}

export interface MessageTemplate {
  id: string;
  owner_type: SchedulingOwnerType;
  owner_id: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateInput {
  name: string;
  channel?: MessageChannel;
  subject?: string;
  body: string;
  is_active?: boolean;
}

/** POST /message-templates/preview response. */
export interface MessageTemplatePreview {
  subject: string;
  body: string;
}

// ─── Payments, packages, invoices ───────────────────────────

export interface PaymentsStatus {
  applicable: boolean;
  connected: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

export interface Package {
  id: string;
  owner_type: SchedulingOwnerType;
  owner_id: string;
  name: string;
  sessions_count: number;
  price_cents: number;
  currency: string;
  event_type_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  /**
   * Purchased-credit tally (the "· N sold" badge). Only present on
   * GET /packages (list) — POST/PUT return the bare row without it.
   */
  sold_count?: number;
}

export interface PackageInput {
  name: string;
  sessions_count: number;
  price_cents?: number;
  currency?: string;
  event_type_id?: string | null;
  is_active?: boolean;
}

/** GET /my-packages credit row (nested package metadata under BookingPackage). */
export interface MyPackageCredit {
  id: string;
  buyer_user_id: string;
  package_id: string;
  remaining_sessions: number;
  purchased_at: string;
  BookingPackage?: {
    name: string;
    sessions_count: number;
    owner_type: SchedulingOwnerType;
    owner_id: string;
    event_type_id: string | null;
  };
}

/** POST /packages/:id/buy response. */
export interface BuyPackageResult {
  credit: {
    id: string;
    package_id: string;
    buyer_user_id: string;
    remaining_sessions: number;
    purchased_at: string;
  };
  clientSecret: string | null;
}

export interface InvoiceLineItem {
  description: string;
  amount_cents: number;
  quantity?: number;
}

export interface Invoice {
  id: string;
  business_user_id: string;
  recipient_user_id: string;
  total_cents: number;
  currency: string;
  line_items?: InvoiceLineItem[];
  created_at: string;
  [key: string]: unknown;
}

// ─── Connected calendars ────────────────────────────────────

export interface ConnectedCalendar {
  id: string;
  provider: string;
  external_account: string | null;
  check_conflicts: boolean;
  write_target: boolean;
  status: string;
  last_synced_at: string | null;
}

// ─── Home resources & visits ────────────────────────────────

export type ResourceType = "room" | "vehicle" | "tool" | "charger" | "other";
export type WhoCanBook = "members" | "specific" | "guests";

export interface Resource {
  id: string;
  home_id: string;
  name: string;
  resource_type: ResourceType;
  photo_url: string | null;
  who_can_book: WhoCanBook;
  max_duration_min: number | null;
  buffer_min: number;
  requires_approval: boolean;
  available_hours: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  created_by?: string | null;
}

export interface ResourceInput {
  name: string;
  resource_type?: ResourceType;
  photo_url?: string;
  who_can_book?: WhoCanBook;
  max_duration_min?: number;
  buffer_min?: number;
  requires_approval?: boolean;
  available_hours?: Record<string, unknown>;
}

// NOTE: POST /resources/:rid/book returns a FULL Booking row (select('*') on
// the Booking table, status 'pending' when the resource requires approval),
// so there is no separate ResourceBooking type — the api layer types it as
// `Booking & { resource_id: string | null }`.

export interface ResourceBookingInput {
  start_at: string;
  duration_min?: number;
  name?: string;
}

export type VisitType = "vendor" | "guest";

export interface Visit {
  id: string;
  home_id: string;
  event_type: VisitType;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  assigned_to: string[] | null;
  location_notes: string | null;
  created_by: string;
  created_at: string;
}

export interface VisitInput {
  visit_type?: VisitType;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  who_is_home?: string[];
  location_notes?: string;
}

// ─── Find-a-time, who's-free, team availability ─────────────

export type FindATimeMode = "collective" | "round_robin";

export interface FindATimeQuery {
  member_ids: string[];
  mode?: FindATimeMode;
  duration_min?: number;
  from: string;
  to: string;
  slot_interval_min?: number;
  timezone?: string;
}

/** GET /find-a-time response. */
export interface FindATime {
  slots: BookingSlot[];
}

/** GET /whos-free and GET /team-availability response (same shape). */
export interface WhosFree {
  members: string[];
  freeByMember: Record<string, BookingSlot[]>;
}

/** Alias for the business team-availability surface (W13/W17). */
export type TeamAvailability = WhosFree;

// ─── Polls ──────────────────────────────────────────────────

export type PollStatus = "open" | "closed";
export type PollVoteValue = "yes" | "maybe" | "no";

export interface PollOption {
  id: string;
  poll_id?: string;
  start_at: string;
  end_at: string;
}

export interface PollVote {
  option_id: string;
  voter_name?: string | null;
  value: PollVoteValue;
}

export interface Poll {
  id: string;
  owner_type?: SchedulingOwnerType;
  owner_id?: string;
  title: string;
  description: string | null;
  duration_min: number;
  status: PollStatus;
  finalized_start_at?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/** GET /polls/:id and GET /public/poll/:id response. */
export interface PollDetail {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

export interface PollInput {
  title: string;
  description?: string;
  duration_min?: number;
  options: Array<{ start: string; end: string }>;
}

export interface PollVoteInput {
  name?: string | null;
  email?: string | null;
  votes: Array<{ option_id: string; value?: PollVoteValue }>;
}

// ─── Waitlist ───────────────────────────────────────────────

/** Matches SchedulingWaitlist_status_chk (migration 165). */
export type WaitlistStatus = "waiting" | "promoted" | "cancelled";

export interface WaitlistEntry {
  id: string;
  event_type_id: string;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_user_id: string | null;
  status: WaitlistStatus;
  created_at: string;
}

// ─── Insights ───────────────────────────────────────────────

/**
 * GET /insights/no-shows — exact payload of
 * bookingMetricsService.getNoShowReport: settled-outcome tallies over the
 * window plus the most recent no-show rows. Per-event-type / per-host
 * breakdowns are NOT returned; compute them client-side from GET /bookings.
 */
export interface NoShowInsights {
  window_days: number;
  completed: number;
  no_show: number;
  cancelled: number;
  /** Integer percent 0–100: no-shows ÷ (completed + no-shows). */
  no_show_rate: number;
  /** Up to 20 most recent no-show bookings, newest first. */
  recent_no_shows: Array<
    Pick<
      Booking,
      "id" | "start_at" | "status" | "invitee_name" | "event_type_id"
    >
  >;
}

/**
 * GET /insights/team — exact payload of
 * bookingMetricsService.getTeamPerformance: per-host status tallies for a
 * business pool, sorted by total descending. No names, revenue or durations —
 * resolve host display names elsewhere (e.g. the business members endpoint).
 */
export interface TeamInsights {
  window_days: number;
  hosts: Array<{
    host_user_id: string;
    total: number;
    confirmed: number;
    completed: number;
    no_show: number;
    cancelled: number;
  }>;
}

// ─── Home calendar union ────────────────────────────────────
// GET /api/homes/:id/events returns HomeCalendarEvent rows UNION live
// confirmed/pending Booking rows (source:'booking'). NEVER create event
// rows for bookings — the union is computed at query time.

export type HomeCalendarUnionSource = "event" | "booking";

export interface HomeCalendarUnionEvent {
  id: string;
  home_id: string;
  event_type: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location_notes: string | null;
  recurrence_rule: string | null;
  assigned_to: string[] | null;
  alerts_enabled: boolean;
  request_rsvp?: boolean;
  reminders?: unknown[];
  created_by: string;
  created_at: string;
  updated_at: string;
  visibility: "private" | "members" | "public_preview";
  /** Union marker — 'booking' rows are READ-ONLY and deep-link to the booking detail. */
  source: HomeCalendarUnionSource;
  /** Only present when source==='booking'. */
  booking_id?: string;
  booking_status?: "pending" | "confirmed";
}

// ─── Typed error envelope ───────────────────────────────────
// { error, message } | 400 { error:'Validation failed', details } | 409 SlotConflict.

export interface ValidationDetail {
  field: string;
  message: string;
  code?: string;
}

export type DecodedSchedulingError =
  | { kind: "conflict"; message: string; conflict: SlotConflict }
  | { kind: "validation"; details: ValidationDetail[]; message: string }
  | { kind: "paused"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "not_implemented"; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "error"; code: string | null; message: string };
