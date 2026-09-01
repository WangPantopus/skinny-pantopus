@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.scheduling

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Bookable home resources (home-only). `GET/POST /resources`,
 * `PUT/DELETE /resources/:rid`, `POST /resources/:rid/book`.
 * `resource_type` ∈ `room|vehicle|tool|charger|other`;
 * `who_can_book` ∈ `members|specific|guests` (members only in v1).
 * `available_hours` is a flexible object.
 */
@JsonClass(generateAdapter = true)
data class ResourceDto(
    val id: String,
    @Json(name = "home_id") val homeId: String? = null,
    val name: String,
    @Json(name = "resource_type") val resourceType: String? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
    @Json(name = "who_can_book") val whoCanBook: String? = null,
    @Json(name = "max_duration_min") val maxDurationMin: Int? = null,
    @Json(name = "buffer_min") val bufferMin: Int? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
    @Json(name = "available_hours") val availableHours: Map<String, Any?>? = null,
    @Json(name = "is_active") val isActive: Boolean? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
)

/** `GET /resources` — `{ resources: [...] }`. */
@JsonClass(generateAdapter = true)
data class GetResourcesResponse(
    val resources: List<ResourceDto> = emptyList(),
)

/** `POST/PUT /resources` — `{ resource: … }`. */
@JsonClass(generateAdapter = true)
data class ResourceResponse(
    val resource: ResourceDto,
)

/** Body for `POST /resources`. */
@JsonClass(generateAdapter = true)
data class CreateResourceRequest(
    val name: String,
    @Json(name = "resource_type") val resourceType: String? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
    @Json(name = "who_can_book") val whoCanBook: String? = null,
    @Json(name = "max_duration_min") val maxDurationMin: Int? = null,
    @Json(name = "buffer_min") val bufferMin: Int? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
    @Json(name = "available_hours") val availableHours: Map<String, Any?>? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** Body for `PUT /resources/:rid` (partial). */
@JsonClass(generateAdapter = true)
data class UpdateResourceRequest(
    val name: String? = null,
    @Json(name = "resource_type") val resourceType: String? = null,
    @Json(name = "photo_url") val photoUrl: String? = null,
    @Json(name = "who_can_book") val whoCanBook: String? = null,
    @Json(name = "max_duration_min") val maxDurationMin: Int? = null,
    @Json(name = "buffer_min") val bufferMin: Int? = null,
    @Json(name = "requires_approval") val requiresApproval: Boolean? = null,
    @Json(name = "available_hours") val availableHours: Map<String, Any?>? = null,
)

/** A resource booking (Booking row with `event_type_id=null`). */
@JsonClass(generateAdapter = true)
data class ResourceBookingDto(
    val id: String,
    @Json(name = "resource_id") val resourceId: String? = null,
    @Json(name = "start_at") val startAt: String? = null,
    @Json(name = "end_at") val endAt: String? = null,
    @Json(name = "invitee_name") val inviteeName: String? = null,
    @Json(name = "created_by") val createdBy: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/** Body for `POST /resources/:rid/book`. */
@JsonClass(generateAdapter = true)
data class BookResourceRequest(
    @Json(name = "start_at") val startAt: String,
    @Json(name = "duration_min") val durationMin: Int? = null,
    val name: String? = null,
    @Json(name = "owner_type") val ownerType: String? = null,
    @Json(name = "owner_id") val ownerId: String? = null,
)

/** `POST /resources/:rid/book` — `{ booking: … }`. */
@JsonClass(generateAdapter = true)
data class BookResourceResponse(
    val booking: ResourceBookingDto,
)
