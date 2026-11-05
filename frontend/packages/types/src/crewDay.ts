// ============================================================
// CREW DAY TYPES (launch cut #13)
// A local crew's street day that each household books and pays for on its own.
// Shapes from docs/product/crew-day-build/02-contract.md; money in cents,
// dates YYYY-MM-DD in the Crew Day's own time zone, times as ISO instants.
// ============================================================

export type CrewDayService =
  | 'gutter_cleaning'
  | 'leaf_cleanup'
  | 'roof_moss'
  | 'holiday_lights'
  | 'window_washing'
  | 'pressure_washing'
  | 'other';

/** A price option; `price_cents` is null when the crew confirms it after a look (`needs_look`). */
export interface CrewDayPriceOption {
  id: string;
  label: string;
  price_cents: number | null;
  needs_look: boolean;
}

export interface CrewDayAddOn {
  id: string;
  label: string;
  price_cents: number;
}

/** What the invitation can say about the day: open, every spot taken, past its booking cutoff, cancelled or done. */
export type CrewDayAvailability = 'open' | 'full' | 'closed' | 'cancelled' | 'done';

export interface CrewDayCrew {
  business_user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  /** Pantopus verified the business's documents: the "Insured and registered" badge. */
  verified: boolean;
  rating: { average: number; count: number } | null;
}

/** Who is looking at an invitation, when signed in. */
export interface CrewDayViewer {
  role: 'crew' | 'household' | 'none';
  booking_id: string | null;
}

/** GET /api/crew-days/public/:code: counts only, never addresses, households or the area's coordinates. */
export interface PublicCrewDay {
  id: string;
  code: string;
  title: string;
  service: CrewDayService;
  street_label: string;
  city: string | null;
  /** The US state ("WA"). */
  state: string | null;
  timezone: string;
  service_date: string;
  window_start: string;
  window_end: string;
  window_starts_at: string;
  window_ends_at: string;
  booking_closes_at: string;
  included: string[];
  outside_only: boolean;
  price_from_cents: number | null;
  price_options: CrewDayPriceOption[];
  add_ons: CrewDayAddOn[];
  capacity: number;
  booked_count: number;
  spots_left: number;
  availability: CrewDayAvailability;
  crew: CrewDayCrew;
  viewer?: CrewDayViewer | null;
}

/** POST /api/crew-days/public/:code/quote: the price for one home, and whether the day reaches it. */
export interface CrewDayQuoteRequest {
  latitude: number;
  longitude: number;
  address_line: string;
  option_id: string;
  add_on_ids: string[];
}

export interface CrewDayQuote {
  in_area: boolean;
  /** Null while the crew confirms it after a look. */
  price_cents: number | null;
  needs_look: boolean;
  line_items?: CrewDayLineItem[];
  message: string | null;
}

/** A booking's status (02-contract.md §2). Active ones count toward the day's capacity. */
export type CrewDayBookingStatus =
  | 'price_pending'
  | 'price_offered'
  | 'booked'
  | 'new_dates'
  | 'on_the_way'
  | 'done'
  | 'paid'
  | 'payment_failed'
  | 'refunded'
  | 'cancelled'
  | 'declined';

export interface CrewDayAddress {
  line: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
}

/** POST /api/crew-days/:id/bookings. A retry with the same `client_request_id` answers with the same booking. */
export interface CreateCrewDayBookingRequest {
  client_request_id: string;
  home_id?: string;
  address: CrewDayAddress;
  option_id: string;
  add_on_ids: string[];
  access_note?: string;
  /** The saved card's Stripe id (`pm_…`). */
  payment_method_id: string;
  approve_terms: true;
}

export interface CrewDayLineItem {
  kind: 'option' | 'add_on';
  id: string;
  label: string;
  price_cents: number | null;
}

export interface CrewDayPhoto {
  path: string;
  /** A signed URL that lasts about an hour. */
  url: string;
}

/** Where a booking's charge stands. */
export type CrewDayChargeState =
  | 'not_yet'
  | 'scheduled'
  | 'paused'
  | 'charged'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'
  | 'none';

export interface CrewDayCharge {
  state: CrewDayChargeState;
  amount_cents: number | null;
  due_at: string | null;
  paid_at: string | null;
  refunded_cents: number;
  failure: string | null;
}

export interface CrewDayProblem {
  status: 'open' | 'resolved' | null;
  kind: 'missed' | 'damage' | 'no_show' | 'charge' | 'other';
  note: string | null;
  opened_at: string | null;
  due_at: string | null;
  resolved_at: string | null;
  resolution: 'released' | 'refunded' | 'partial_refund' | 'resolved' | null;
  refunded_cents: number;
}

export interface CrewDayProposal {
  id: string;
  dates: Array<{ date: string; window_start: string; window_end: string }>;
  deadline_at: string;
  note: string | null;
  sent_at: string;
}

export interface CrewDayEvent {
  id: string;
  kind: string;
  actor_role: 'household' | 'crew' | 'operator' | 'system';
  data: Record<string, unknown> | null;
  created_at: string;
  [field: string]: unknown;
}

export interface CrewDayStep {
  key: 'booked' | 'on_the_way' | 'done' | 'paid';
  /** "Requested" while the crew checks the price. */
  label: string;
  state: 'done' | 'current' | 'todo';
}

/** GET /api/crew-days/bookings/:bookingId: the household's booking page (screen 5). */
export interface CrewDayBookingPage {
  id: string;
  crew_day: {
    id: string;
    code: string;
    title: string;
    service: CrewDayService;
    service_label: string;
    street_label: string;
    city: string | null;
    state: string | null;
    timezone: string;
    status: string;
    included: string[];
    outside_only: boolean;
    crew: CrewDayCrew;
  };
  status: CrewDayBookingStatus;
  steps: CrewDayStep[];
  service_date: string;
  window_start: string;
  window_end: string;
  window_starts_at: string;
  window_ends_at: string;
  eta: { start: string; end: string; updated_at: string | null } | null;
  gate_ready_at: string | null;
  cant_get_in_at: string | null;
  prep_note: string | null;
  access_note: string | null;
  address: { line: string; city: string | null; state: string | null; zip: string | null };
  home_id: string | null;
  option: { id: string; label: string };
  add_ons: Array<{ id: string; label: string; price_cents: number | null }>;
  line_items: CrewDayLineItem[];
  price_cents: number | null;
  card: { brand: string; last4: string } | null;
  cancel_cutoff_at: string | null;
  can_cancel: boolean;
  can_change: boolean;
  can_ask_release: boolean;
  release_asked_at: string | null;
  charge: CrewDayCharge;
  invoice_id: string | null;
  done_at: string | null;
  done_note: string | null;
  photos: CrewDayPhoto[];
  problem_photos?: CrewDayPhoto[];
  household_confirmed_at: string | null;
  problem: CrewDayProblem | null;
  proposal: CrewDayProposal | null;
  new_date_choice: { proposal_id: string; date: string; answered_at: string } | null;
  remind_next_season: boolean;
  cancelled_by: 'household' | 'crew' | 'operator' | 'system' | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  share: { url: string; flyer_url: string; message: string; booked_count: number; spots_left: number } | null;
  events: CrewDayEvent[];
  created_at: string;
}
