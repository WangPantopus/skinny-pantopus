@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Household visits (home-only). `POST /visits` creates a `HomeCalendarEvent`.
 * `visit_type` ∈ `vendor|guest`. Visit *detail* is read via the home-calendar
 * router (`GET /api/homes/:id/events/:eventId`), owned by the Home Calendar
 * module — not represented here.
 */
@JsonClass(generateAdapter = true)
data class VisitDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    @Json(name = "event_type") val eventType: String? = null,
    val title: String? = null,
    val description: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "assigned_to") val assignedTo: List<String>? = null,
    @Json(name = "location_notes") val locationNotes: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** Body for `POST /visits`. Range must be valid and ≤30 days (`BAD_RANGE`). */
@JsonClass(generateAdapter = true)
data class CreateVisitRequest(
    val title: String,
    @Json(name = "start_at") val startAt: String,
    @Json(name = "end_at") val endAt: String,
    @Json(name = "visit_type") val visitType: String? = null,
    val description: String? = null,
    @Json(name = "who_is_home") val whoIsHome: List<String>? = null,
    @Json(name = "location_notes") val locationNotes: String? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** `POST /visits` — `{ visit: … }`. */
@JsonClass(generateAdapter = true)
data class VisitResponse(
    val visit: VisitDto,
)
