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

/** The parts of a household's booking every Crew Day screen reads; GET /api/crew-days/bookings/:bookingId has more. */
export interface CrewDayBookingSummary {
  id: string;
  crew_day_id: string;
  status: CrewDayBookingStatus;
  price_cents: number | null;
  option_id: string;
  add_on_ids: string[];
  service_date?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  prep_note?: string | null;
  access_note?: string | null;
  [field: string]: unknown;
}
