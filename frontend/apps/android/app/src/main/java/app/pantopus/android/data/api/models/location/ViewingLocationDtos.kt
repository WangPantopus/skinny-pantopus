package app.pantopus.android.data.api.models.location

import com.squareup.moshi.JsonClass

/**
 * Wire types for `/api/location` (`backend/routes/location.js`). The
 * serializers hand-map every column to camelCase (`formatVL` at
 * `backend/routes/location.js:49`, `formatRecent` at
 * `backend/routes/location.js:67`), so no `@Json` renames are needed.
 */

/** `GET /api/location` (`backend/routes/location.js:116-135`). */
@JsonClass(generateAdapter = true)
data class ViewingLocationPayload(
    val viewingLocation: ViewingLocationDto? = null,
    val recentLocations: List<RecentLocationDto> = emptyList(),
    val homes: List<HomeLocationDto> = emptyList(),
    val businessLocations: List<BusinessLocationDto> = emptyList(),
)

/** The active viewing location (`backend/routes/location.js:49`). */
@JsonClass(generateAdapter = true)
data class ViewingLocationDto(
    val label: String,
    /** `gps | home | business | searched | recent`. */
    val type: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMiles: Double? = null,
    val isPinned: Boolean? = null,
    val sourceId: String? = null,
    val city: String? = null,
    val state: String? = null,
    val updatedAt: String? = null,
)

/** One row of the recents list (`backend/routes/location.js:67`). */
@JsonClass(generateAdapter = true)
data class RecentLocationDto(
    val id: String,
    val label: String,
    val type: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMiles: Double? = null,
    val sourceId: String? = null,
    val city: String? = null,
    val state: String? = null,
    val usedAt: String? = null,
)

/**
 * One of the viewer's homes with coordinates
 * (`backend/routes/location.js:120-127`).
 */
@JsonClass(generateAdapter = true)
data class HomeLocationDto(
    val id: String,
    val name: String? = null,
    val city: String? = null,
    val state: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/**
 * One of the viewer's business locations
 * (`backend/routes/location.js:128-136`).
 */
@JsonClass(generateAdapter = true)
data class BusinessLocationDto(
    val id: String,
    val businessName: String? = null,
    val label: String? = null,
    val city: String? = null,
    val state: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** Body for `PUT /api/location` (`backend/routes/location.js:151`). */
@JsonClass(generateAdapter = true)
data class SetViewingLocationRequest(
    /** `gps | home | business | searched | recent`. */
    val type: String,
    val label: String,
    val latitude: Double,
    val longitude: Double,
    val radiusMiles: Double,
    val isPinned: Boolean = false,
    val sourceId: String? = null,
    val city: String? = null,
    val state: String? = null,
)

/** `PUT /api/location` echo (`backend/routes/location.js:224`). */
@JsonClass(generateAdapter = true)
data class SetViewingLocationResponse(
    val viewingLocation: ViewingLocationDto? = null,
)

/** Body for `PUT /api/location/radius` (`backend/routes/location.js:270`). */
@JsonClass(generateAdapter = true)
data class SetViewingRadiusRequest(
    val radiusMiles: Double,
)

/** `PUT /api/location/radius` echo (`backend/routes/location.js:288`). */
@JsonClass(generateAdapter = true)
data class SetViewingRadiusResponse(
    val radiusMiles: Double? = null,
)
