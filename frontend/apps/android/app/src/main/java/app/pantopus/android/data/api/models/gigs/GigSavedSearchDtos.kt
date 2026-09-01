@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * P6a — one row from `GET /api/gigs/saved-searches`. Mirrors the
 * `GigSavedSearch` table (`backend/routes/gigSavedSearches.js`).
 */
@JsonClass(generateAdapter = true)
data class GigSavedSearchDto(
    val id: String,
    @Json(name = "user_id") val userId: String? = null,
    val name: String? = null,
    val category: String? = null,
    val search: String? = null,
    @Json(name = "min_price") val minPrice: Double? = null,
    @Json(name = "max_price") val maxPrice: Double? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
    @Json(name = "pay_type") val payType: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "radius_miles") val radiusMiles: Double? = null,
    val notify: Boolean? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    @Json(name = "last_notified_at") val lastNotifiedAt: String? = null,
)

/** `GET /api/gigs/saved-searches` envelope — newest first. */
@JsonClass(generateAdapter = true)
data class GigSavedSearchesResponse(
    val searches: List<GigSavedSearchDto> = emptyList(),
)

/**
 * Envelope for create (`201 {search}` / dedupe `200 {search, deduped:
 * true}`) and update (`{search}`) mutations.
 */
@JsonClass(generateAdapter = true)
data class GigSavedSearchMutationResponse(
    val search: GigSavedSearchDto,
    val deduped: Boolean? = null,
)

/** `DELETE /api/gigs/saved-searches/:id` → `{message}`. */
@JsonClass(generateAdapter = true)
data class GigSavedSearchDeleteResponse(
    val message: String? = null,
)

/**
 * `POST /api/gigs/saved-searches` body. Latitude/longitude are required
 * by the backend schema; every criteria field is optional and omitted
 * (Moshi drops nulls) when the dimension is inactive.
 */
@JsonClass(generateAdapter = true)
data class CreateGigSavedSearchBody(
    val name: String? = null,
    val category: String? = null,
    val search: String? = null,
    @Json(name = "min_price") val minPrice: Double? = null,
    @Json(name = "max_price") val maxPrice: Double? = null,
    @Json(name = "schedule_type") val scheduleType: String? = null,
    @Json(name = "pay_type") val payType: String? = null,
    val latitude: Double,
    val longitude: Double,
    @Json(name = "radius_miles") val radiusMiles: Double = 5.0,
    val notify: Boolean = true,
)

/** `PATCH /api/gigs/saved-searches/:id` body — at least one field. */
@JsonClass(generateAdapter = true)
data class UpdateGigSavedSearchBody(
    val name: String? = null,
    val notify: Boolean? = null,
    @Json(name = "radius_miles") val radiusMiles: Double? = null,
)
