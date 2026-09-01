@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.saved_places

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * BLOCK 2E — "Saved places" DTOs. Decodes the `{ savedPlaces }` /
 * `{ savedPlace }` envelopes from `backend/routes/savedPlaces.js`. The GET/echo
 * rows are a raw table `select('*')`, so their keys are snake_case and need
 * `@Json(name = …)`. The POST body, however, is read camelCase on the server
 * (`req.body.placeType`, …), so [SavePlaceBody] ships property names as-is.
 */

/** `GET /api/saved-places` envelope. */
@JsonClass(generateAdapter = true)
data class SavedPlacesListResponse(
    val savedPlaces: List<SavedPlaceDto> = emptyList(),
)

/** `POST /api/saved-places` echo (the upserted row). */
@JsonClass(generateAdapter = true)
data class SavedPlaceResponse(
    val savedPlace: SavedPlaceDto,
)

/** One saved place. Only the fields the list + toggle read are modelled. */
@JsonClass(generateAdapter = true)
data class SavedPlaceDto(
    val id: String,
    val label: String,
    /** `home | work | searched | saved`. */
    @Json(name = "place_type") val placeType: String = "saved",
    val latitude: Double,
    val longitude: Double,
    val city: String? = null,
    val state: String? = null,
    @Json(name = "source_id") val sourceId: String? = null,
    @Json(name = "geocode_place_id") val geocodePlaceId: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
)

/**
 * Body for `POST /api/saved-places`. The backend reads camelCase keys, so no
 * `@Json` remapping is required. `label`, `latitude`, `longitude` are required
 * server-side; `placeType` defaults to `searched`. The upsert keys on
 * `(user, latitude, longitude)`, so re-posting the same coordinate replaces the
 * row rather than duplicating it.
 */
@JsonClass(generateAdapter = true)
data class SavePlaceBody(
    val label: String,
    val placeType: String,
    val latitude: Double,
    val longitude: Double,
    val city: String? = null,
    val state: String? = null,
    val geocodePlaceId: String? = null,
    val sourceId: String? = null,
) {
    companion object {
        /** Rebuild a save body from an existing row — used by the Undo path. */
        fun from(dto: SavedPlaceDto): SavePlaceBody =
            SavePlaceBody(
                label = dto.label,
                placeType = dto.placeType,
                latitude = dto.latitude,
                longitude = dto.longitude,
                city = dto.city,
                state = dto.state,
                geocodePlaceId = dto.geocodePlaceId,
                sourceId = dto.sourceId,
            )
    }
}

/** `DELETE /api/saved-places/:id` echo (`{ message }`). */
@JsonClass(generateAdapter = true)
data class SavedPlaceDeleteResponse(
    val message: String? = null,
)
