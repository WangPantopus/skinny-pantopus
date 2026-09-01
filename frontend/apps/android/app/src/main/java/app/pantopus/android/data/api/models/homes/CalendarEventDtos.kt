@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * One row from `GET /api/homes/:id/events` — route
 * `backend/routes/home.js:4793`.
 */
@JsonClass(generateAdapter = true)
data class CalendarEventDto(
    val id: String,
    @Json(name = "home_id") val homeId: String,
    @Json(name = "event_type") val eventType: String,
    val title: String,
    val description: String? = null,
    /** ISO-8601 timestamp. */
    @Json(name = "start_at") val startAt: String,
    /** ISO-8601 timestamp. Null for all-day / point-in-time events. */
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "location_notes") val locationNotes: String? = null,
    /** iCal RRULE string ("FREQ=WEEKLY"), null for one-off events. */
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    /** Backend stores an array of user-ids (assigned household members). */
    @Json(name = "assigned_to") val assignedTo: List<String>? = null,
    @Json(name = "alerts_enabled") val alertsEnabled: Boolean? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    /** Row visibility — `private` | `members` | `public_preview`. */
    val visibility: String? = null,
    /**
     * Booking-union marker — `event` (a real HomeCalendarEvent row) or
     * `booking` (a Booking row query-time merged into the calendar, never
     * persisted). Absent rows default to an event. Added with migrations
     * 159–165 (`home.js:5068`).
     */
    val source: String? = null,
    /** Only present when [source] == `booking` — the originating booking id. */
    @Json(name = "booking_id") val bookingId: String? = null,
    /** Only present when [source] == `booking` — `pending` | `confirmed`. */
    @Json(name = "booking_status") val bookingStatus: String? = null,
    /** Whether attendees are prompted for a Going / Maybe / Can't RSVP (migration 164). */
    @Json(name = "request_rsvp") val requestRsvp: Boolean? = null,
    /** Reminder lead-times, in minutes-before-start (jsonb array, migration 164). */
    val reminders: List<Int>? = null,
) {
    /** True when this row is a query-time booking-union row (read-only). */
    val isBooking: Boolean get() = source == "booking"
}

/** Envelope for `GET /api/homes/:id/events`. */
@JsonClass(generateAdapter = true)
data class GetHomeEventsResponse(
    val events: List<CalendarEventDto> = emptyList(),
)

/** Body for `POST /api/homes/:id/events` — route
 *  `backend/routes/home.js:4827`. */
@JsonClass(generateAdapter = true)
data class CreateHomeEventRequest(
    @Json(name = "event_type") val eventType: String,
    val title: String,
    @Json(name = "start_at") val startAt: String,
    val description: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "location_notes") val locationNotes: String? = null,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    @Json(name = "assigned_to") val assignedTo: List<String>? = null,
    @Json(name = "alerts_enabled") val alertsEnabled: Boolean? = null,
    @Json(name = "request_rsvp") val requestRsvp: Boolean? = null,
    val reminders: List<Int>? = null,
)

/**
 * Body for `PUT /api/homes/:id/events/:eventId` — route
 * `backend/routes/home.js:5082`. All keys optional; the server's
 * allow-list at line 5090 picks up only present fields. Empty strings
 * are accepted (and the server stores them verbatim) so the form can
 * clear location / notes / recurrence on edit.
 */
@JsonClass(generateAdapter = true)
data class UpdateHomeEventRequest(
    @Json(name = "event_type") val eventType: String? = null,
    val title: String? = null,
    val description: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "location_notes") val locationNotes: String? = null,
    @Json(name = "recurrence_rule") val recurrenceRule: String? = null,
    @Json(name = "assigned_to") val assignedTo: List<String>? = null,
    @Json(name = "alerts_enabled") val alertsEnabled: Boolean? = null,
    @Json(name = "request_rsvp") val requestRsvp: Boolean? = null,
    val reminders: List<Int>? = null,
)

/** Envelope for `POST /api/homes/:id/events` and `PUT …/:eventId`. */
@JsonClass(generateAdapter = true)
data class HomeEventResponse(
    val event: CalendarEventDto,
)

/**
 * One attendee RSVP row from `GET /api/homes/:id/events/:eventId` and
 * `POST /api/homes/:id/events/:eventId/rsvp` — route `home.js:5219`.
 * Only `user_id`, `rsvp_status`, (and `updated_at` on the detail read)
 * are returned by the backend.
 */
@JsonClass(generateAdapter = true)
data class HomeEventAttendeeDto(
    @Json(name = "user_id") val userId: String,
    /** `pending` | `going` | `maybe` | `declined`. */
    @Json(name = "rsvp_status") val rsvpStatus: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
)

/**
 * Envelope for `GET /api/homes/:id/events/:eventId` — route
 * `home.js:5205`. Event detail plus per-user RSVP rows (empty when
 * nobody has replied).
 */
@JsonClass(generateAdapter = true)
data class HomeEventDetailResponse(
    val event: CalendarEventDto,
    val attendees: List<HomeEventAttendeeDto> = emptyList(),
)

/** Body for `POST /api/homes/:id/events/:eventId/rsvp` — route `home.js:5231`. */
@JsonClass(generateAdapter = true)
data class HomeEventRsvpRequest(
    /** `going` | `maybe` | `declined` | `pending` (case-sensitive). */
    val status: String,
)

/** Envelope for `POST /api/homes/:id/events/:eventId/rsvp`. */
@JsonClass(generateAdapter = true)
data class HomeEventRsvpResponse(
    val attendee: HomeEventAttendeeDto,
)
