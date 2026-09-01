@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * The host's public booking page. `GET/PUT /booking-page`,
 * `POST /booking-page/{disable,reset-slug}`, `PUT /booking-page/slug`.
 *
 * `branding` is a flexible object (`Map`); `reminder_minutes` is the default
 * reminder offsets. Owner context is carried by the request, never persisted
 * back into these fields (the backend strips `owner_type`/`owner_id`).
 */
@JsonClass(generateAdapter = true)
data class BookingPageDto(
    val id: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
    val slug: String? = null,
    @Json(name = "is_live") val isLive: Boolean = false,
    @Json(name = "is_paused") val isPaused: Boolean = false,
    val title: String? = null,
    val tagline: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    val intro: String? = null,
    @Json(name = "confirmation_message") val confirmationMessage: String? = null,
    val timezone: String? = null,
    @Json(name = "reminder_minutes") val reminderMinutes: List<Int> = emptyList(),
    @Json(name = "cancellation_policy") val cancellationPolicy: String? = null,
    val visibility: String? = null,
    val branding: Map<String, Any?>? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "updated_at") val updatedAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
)

/** Envelope for every booking-page read/write — `{ page: … }`. */
@JsonClass(generateAdapter = true)
data class BookingPageResponse(
    val page: BookingPageDto,
)

/**
 * Body for `PUT /booking-page`. All optional (partial update). `ownerType`/
 * `ownerId` are owner-context fields the repository injects for Business; the
 * backend strips them from the persisted row.
 */
@JsonClass(generateAdapter = true)
data class UpdateBookingPageRequest(
    val title: String? = null,
    val tagline: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String? = null,
    val intro: String? = null,
    @Json(name = "confirmation_message") val confirmationMessage: String? = null,
    val timezone: String? = null,
    @Json(name = "is_live") val isLive: Boolean? = null,
    @Json(name = "is_paused") val isPaused: Boolean? = null,
    @Json(name = "reminder_minutes") val reminderMinutes: List<Int>? = null,
    @Json(name = "cancellation_policy") val cancellationPolicy: String? = null,
    val visibility: String? = null,
    val branding: Map<String, Any?>? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `PUT /booking-page/slug`. */
@JsonClass(generateAdapter = true)
data class UpdateSlugRequest(
    val slug: String,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/**
 * `GET /booking-page/check-slug` — live availability for the first-run wizard.
 * `suggestions` carries up to 3 alternatives when the slug is taken.
 */
@JsonClass(generateAdapter = true)
data class CheckSlugResponse(
    val available: Boolean = false,
    val suggestions: List<String> = emptyList(),
    val error: String? = null,
    val message: String? = null,
)

/** One offered time for a constrained one-off link (`offered_slots[]`). */
@JsonClass(generateAdapter = true)
data class OneOffSlotInput(
    val start: String,
    val end: String,
)

/** Body for `POST /booking-page/one-off-links`. */
@JsonClass(generateAdapter = true)
data class OneOffLinkRequest(
    @Json(name = "event_type_id") val eventTypeId: String,
    @Json(name = "expires_in_min") val expiresInMin: Int? = null,
    @Json(name = "single_use") val singleUse: Boolean? = null,
    @Json(name = "offered_slots") val offeredSlots: List<OneOffSlotInput>? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/**
 * `POST /booking-page/one-off-links` response. The raw `token` is returned
 * **once** — persist it in the share href.
 */
@JsonClass(generateAdapter = true)
data class OneOffLinkResponse(
    val token: String,
    val path: String,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "single_use") val singleUse: Boolean = true,
)
