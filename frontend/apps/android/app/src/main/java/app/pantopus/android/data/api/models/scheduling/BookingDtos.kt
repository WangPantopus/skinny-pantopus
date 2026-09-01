@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * A host-side booking. `GET /bookings`, `GET /bookings/:id`, lifecycle actions
 * (`approve/decline/cancel/reschedule/no-show/reassign/nudge/propose-reschedule`),
 * manual `POST /bookings`, `POST /bookings/recurring`, and the customer
 * `GET /my-bookings`.
 *
 * `status` ∈ `pending|confirmed|cancelled|declined|completed|no_show`. Times are
 * UTC ISO. `intake_answers` is a flexible map; owner context is request-only.
 */
@JsonClass(generateAdapter = true)
data class BookingDto(
    val id: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    /**
     * Resource bookings are `Booking` rows with `event_type_id = null` and
     * `resource_id` set. The `GET …/scheduling/bookings` host list selects `*`
     * and therefore returns `resource_id`, so A12 (home resources) can scope a
     * resource's bookings client-side. Always `null` for ordinary event-type
     * bookings, so this is additive for every other stream. The `/events`
     * union (home.js) deliberately omits `resource_id`, which is why the
     * resource surfaces read the host bookings list instead of the union.
     */
    @Json(name = "resource_id") val resourceId: String? = null,
    val status: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "invitee_email") val inviteeEmail: String? = null,
    @Json(name = "invitee_user_id") val inviteeUserId: String? = null,
    @Json(name = "invitee_timezone") val inviteeTimezone: String? = null,
    @Json(name = "host_user_id") val hostUserId: String? = null,
    @Json(name = "intake_answers") val intakeAnswers: Map<String, Any?>? = null,
    @Json(name = "payment_id") val paymentId: String? = null,
    @Json(name = "package_credit_id") val packageCreditId: String? = null,
    @Json(name = "previous_start_at") val previousStartAt: String? = null,
    @Json(name = "cancel_reason") val cancelReason: String? = null,
    @Json(name = "created_via") val createdVia: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/** One attendee on a booking (seats / RSVP). */
@JsonClass(generateAdapter = true)
data class AttendeeDto(
    val id: String? = null,
    @Json(name = "booking_id") val bookingId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    val email: String? = null,
    val name: String? = null,
    @Json(name = "rsvp_status") val rsvpStatus: String? = null,
)

/** Minimal event-type metadata returned alongside a booking detail. */
@JsonClass(generateAdapter = true)
data class BookingEventTypeRef(
    val id: String? = null,
    val name: String? = null,
    @Json(name = "location_mode") val locationMode: String? = null,
)

/** `GET /bookings`, `GET /my-bookings` — `{ bookings: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetBookingsResponse(
    val bookings: List<BookingDto> = emptyList(),
)

/** `GET /bookings/:id` — booking + attendees + minimal event type. */
@JsonClass(generateAdapter = true)
data class BookingDetailResponse(
    val booking: BookingDto,
    val attendees: List<AttendeeDto> = emptyList(),
    val eventType: BookingEventTypeRef? = null,
)

/** Lifecycle-action responses (`approve/decline/cancel/reschedule/no-show/reassign/propose`). */
@JsonClass(generateAdapter = true)
data class BookingResponse(
    val booking: BookingDto,
)

/**
 * `POST /bookings` (manual create) — `{ booking, manageToken, clientSecret }`.
 * `clientSecret` drives the Stripe payment for a priced event type's manual
 * booking; `manageToken` is the booker's one-time handle.
 */
@JsonClass(generateAdapter = true)
data class CreateBookingResponse(
    val booking: BookingDto,
    val manageToken: String? = null,
    val clientSecret: String? = null,
)

/** One session that couldn't be booked in a recurring series. */
@JsonClass(generateAdapter = true)
data class RecurringFailure(
    val start: String? = null,
    val error: String? = null,
    val message: String? = null,
)

/**
 * `POST /bookings/recurring` — `{ recurrenceGroupId, created, failed }`.
 * `created` are the booked sessions; `failed` reports per-session conflicts.
 */
@JsonClass(generateAdapter = true)
data class RecurringBookingsResponse(
    val recurrenceGroupId: String? = null,
    val created: List<BookingDto> = emptyList(),
    val failed: List<RecurringFailure> = emptyList(),
)

/** `POST /bookings/:id/rsvp` — `{ attendee: … }`. */
@JsonClass(generateAdapter = true)
data class AttendeeResponse(
    val attendee: AttendeeDto,
)

/** One day's count in the 30-day summary sparkline. */
@JsonClass(generateAdapter = true)
data class SummarySparkPoint(
    val date: String? = null,
    val count: Int = 0,
)

/** Per-event-type booking count in the summary breakdown. */
@JsonClass(generateAdapter = true)
data class SummaryByEventType(
    @Json(name = "event_type_id") val eventTypeId: String? = null,
    val count: Int = 0,
)

/**
 * `GET /bookings/summary` — Scheduling Hub headline metrics. Matches the live
 * `bookingMetricsService.getSummary` shape (the companion doc drifted).
 */
@JsonClass(generateAdapter = true)
data class BookingSummaryResponse(
    @Json(name = "bookingsThisMonth") val bookingsThisMonth: Int = 0,
    @Json(name = "bookingsLastMonth") val bookingsLastMonth: Int = 0,
    @Json(name = "deltaPct") val deltaPct: Int = 0,
    @Json(name = "upcomingCount") val upcomingCount: Int = 0,
    @Json(name = "noShowCount") val noShowCount: Int = 0,
    val sparkline: List<SummarySparkPoint> = emptyList(),
    val byEventType: List<SummaryByEventType> = emptyList(),
)

/** `POST /bookings/:id/apply-credit` — `{ ok, remaining }`. */
@JsonClass(generateAdapter = true)
data class ApplyCreditResponse(
    val ok: Boolean = true,
    val remaining: Int? = null,
)

// ─── Request bodies ────────────────────────────────────────────────────────

/** Body for `POST /bookings` (manual / on-behalf create). */
@JsonClass(generateAdapter = true)
data class CreateBookingRequest(
    @Json(name = "event_type_id") val eventTypeId: String,
    @Json(name = "start_at") val startAt: String,
    @Json(name = "duration_min") val durationMin: Int? = null,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "invitee_email") val inviteeEmail: String? = null,
    @Json(name = "invitee_phone") val inviteePhone: String? = null,
    @Json(name = "invitee_timezone") val inviteeTimezone: String? = null,
    @Json(name = "intake_answers") val intakeAnswers: Map<String, Any?>? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `POST /bookings/recurring`. `sessions` = 1–52 ISO start times. */
@JsonClass(generateAdapter = true)
data class CreateRecurringRequest(
    @Json(name = "event_type_id") val eventTypeId: String,
    val sessions: List<String>,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "invitee_email") val inviteeEmail: String? = null,
    @Json(name = "invitee_timezone") val inviteeTimezone: String? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `POST /bookings/:id/decline` and `…/cancel` (optional reason). */
@JsonClass(generateAdapter = true)
data class BookingReasonRequest(
    val reason: String? = null,
)

/** Body for `POST /bookings/:id/reschedule` (host). */
@JsonClass(generateAdapter = true)
data class HostRescheduleRequest(
    @Json(name = "start_at") val startAt: String,
    @Json(name = "host_user_id") val hostUserId: String? = null,
    val reason: String? = null,
)

/** Body for `POST /bookings/:id/propose-reschedule`. */
@JsonClass(generateAdapter = true)
data class ProposeRescheduleRequest(
    @Json(name = "start_at") val startAt: String,
    @Json(name = "host_user_id") val hostUserId: String? = null,
)

/** Body for `POST /bookings/:id/reassign`. */
@JsonClass(generateAdapter = true)
data class ReassignRequest(
    @Json(name = "host_user_id") val hostUserId: String,
    val reason: String? = null,
)

/** Body for `POST /bookings/:id/nudge` (optional message). */
@JsonClass(generateAdapter = true)
data class NudgeRequest(
    val message: String? = null,
)

/** Body for `POST /bookings/:id/rsvp`. `status` ∈ `going|maybe|declined|pending`. */
@JsonClass(generateAdapter = true)
data class RsvpRequest(
    val status: String,
)

/** Body for `POST /bookings/:id/apply-credit`. */
@JsonClass(generateAdapter = true)
data class ApplyCreditRequest(
    @Json(name = "credit_id") val creditId: String,
)
