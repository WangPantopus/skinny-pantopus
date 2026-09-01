/**
 * Explicit column selections for Supabase queries.
 *
 * Using explicit columns instead of select('*') reduces bandwidth,
 * enables covering-index scans, and makes the API contract explicit.
 *
 * Convention:
 *   TABLE_LIST  — columns needed for list/feed endpoints (compact)
 *   TABLE_DETAIL — columns needed for single-item detail views (full)
 *
 * When adding a new column to a table, add it to the relevant constant(s)
 * so endpoints return it.
 */

// ─── Gig ────────────────────────────────────────────────────────────────────

/** Columns for gig list views (my gigs, managed gigs, search results) */
const GIG_LIST = `
  id, title, description, price, category, deadline,
  status, user_id, accepted_by, accepted_at,
  created_at, updated_at, is_urgent, tags,
  scheduled_start, payment_status,
  origin_mode, origin_home_id,
  ref_listing_id, ref_post_id,
  created_by, beneficiary_user_id,
  engagement_mode, schedule_type, pay_type,
  task_archetype, task_format, source_flow,
  starts_asap, response_window_minutes,
  pickup_address, dropoff_address,
  requires_license, scope_description,
  care_details, logistics_details, remote_details,
  urgent_details, event_details,
  boosted_at, boost_expires_at
`.replace(/\s+/g, ' ').trim();

/** All columns for gig detail view (single gig page) */
const GIG_DETAIL = '*';

// ─── Post ───────────────────────────────────────────────────────────────────

/** Columns for feed/list views */
const POST_LIST = `
  id, user_id, home_id, content, media_urls, media_types, media_thumbnails,
  post_type, visibility, like_count, comment_count, share_count,
  is_pinned, is_edited, created_at, updated_at,
  location_name, title, post_format, tags,
  event_date, event_end_date, event_venue,
  safety_alert_kind, deal_expires_at, deal_business_name,
  lost_found_type, service_category,
  post_as, audience, business_id,
  is_story, story_expires_at,
  matched_business_ids, matched_businesses_cache,
  latitude, longitude
`.replace(/\s+/g, ' ').trim();

/** All columns for post detail */
const POST_DETAIL = '*';

// ─── Home ───────────────────────────────────────────────────────────────────

/** Columns for home list / dashboard */
const HOME_LIST = `
  id, address, city, state, zipcode, location,
  owner_id, name, home_type,
  primary_photo_url, cover_photo_url, description,
  visibility, home_status,
  bedrooms, bathrooms, sq_ft, year_built,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** All columns for home detail */
const HOME_DETAIL = '*';

// ─── Home sub-tables (tasks, issues, bills, packages, events) ───────────

const HOME_TASK_LIST = `
  id, home_id, task_type, title, description,
  assigned_to, due_at, status, priority, budget,
  completed_at, linked_gig_id, converted_to_gig_id,
  created_by, created_at, updated_at, visibility, mail_id
`.replace(/\s+/g, ' ').trim();

const HOME_ISSUE_LIST = `
  id, home_id, title, description, severity, status,
  reported_by, assigned_vendor_id, estimated_cost, photos,
  linked_gig_id, resolved_at,
  created_at, updated_at, visibility
`.replace(/\s+/g, ' ').trim();

const HOME_BILL_LIST = `
  id, home_id, bill_type, provider_name, amount, currency,
  period_start, period_end, due_date, status,
  paid_at, paid_by,
  created_by, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const HOME_PACKAGE_LIST = `
  id, home_id, carrier, tracking_number, vendor_name, description,
  delivery_instructions, status, expected_at, delivered_at,
  picked_up_by, created_by, created_at, updated_at, visibility
`.replace(/\s+/g, ' ').trim();

const HOME_EVENT_LIST = `
  id, home_id, event_type, title, description,
  start_at, end_at, location_notes, recurrence_rule,
  assigned_to, alerts_enabled,
  created_by, created_at, updated_at, visibility
`.replace(/\s+/g, ' ').trim();

// ─── Notification ───────────────────────────────────────────────────────────

/** All columns (table is small — 10 columns) */
const NOTIFICATION_LIST = `
  id, user_id, type, title, body, icon, link,
  is_read, metadata, created_at,
  context, context_type, context_id
`.replace(/\s+/g, ' ').trim();

// ─── Business Seat ──────────────────────────────────────────────────────────

/** Columns for seat list views (team panel) */
const SEAT_LIST = `
  id, business_user_id, display_name, display_avatar_file_id,
  role_base, contact_method, is_active, invite_status,
  invite_email, accepted_at, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** All columns for single-seat detail view */
const SEAT_DETAIL = `
  id, business_user_id, display_name, display_avatar_file_id,
  role_base, contact_method, is_active,
  invited_by_seat_id, invite_email, invite_status,
  accepted_at, deactivated_at, deactivated_reason,
  notes, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// ─── Listing ────────────────────────────────────────────────────────────────

/** Columns for marketplace listing list views */
const LISTING_LIST = `
  id, user_id, title, description, price, is_free,
  category, subcategory, condition, quantity, status,
  media_urls, media_types, media_thumbnails, location_name,
  latitude, longitude, visibility_scope, radius_miles,
  meetup_preference, delivery_available, tags,
  view_count, save_count, message_count, active_offer_count,
  layer, listing_type, home_id, is_address_attached,
  quality_score, context_tags, is_wanted, budget_max, expires_at,
  open_to_trades, trade_preferences,
  ingredients, allergens, preparation_date, best_by_date, food_handler_certified,
  is_recurring, recurrence_schedule, is_preorder, preorder_deadline, preorder_fulfillment_date,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** All columns for listing detail */
const LISTING_DETAIL = '*';

module.exports = {
  GIG_LIST,
  GIG_DETAIL,
  POST_LIST,
  POST_DETAIL,
  HOME_LIST,
  HOME_DETAIL,
  HOME_TASK_LIST,
  HOME_ISSUE_LIST,
  HOME_BILL_LIST,
  HOME_PACKAGE_LIST,
  HOME_EVENT_LIST,
  NOTIFICATION_LIST,
  LISTING_LIST,
  LISTING_DETAIL,
  SEAT_LIST,
  SEAT_DETAIL,
};
