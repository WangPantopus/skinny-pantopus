package app.pantopus.android.data.api.models.geo

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** Normalized address from reverse geocode. Route: `backend/routes/geo.js`. */
@JsonClass(generateAdapter = true)
data class NormalizedAddress(
    val address: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    @Json(name = "place_id") val placeId: String? = null,
    val verified: Boolean? = null,
    val source: String? = null,
) {
    val localityLabel: String
        get() =
            listOfNotNull(city, state)
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .joinToString(", ")
}

/** `GET /api/geo/reverse` envelope. */
@JsonClass(generateAdapter = true)
data class GeoReverseResponse(
    val normalized: NormalizedAddress,
)

/**
 * One address-typeahead suggestion from `GET /api/geo/autocomplete`.
 *
 * NOTE the wire shape (verified against the live backend): `center` is
 * a GeoJSON-style `[lng, lat]` ARRAY, not a `{lat, lng}` object (the
 * web `GeoSuggestion` TS type claims an object — the wire wins).
 */
@JsonClass(generateAdapter = true)
data class GeoSuggestion(
    @Json(name = "suggestion_id") val suggestionId: String,
    @Json(name = "place_id") val placeId: String? = null,
    @Json(name = "primary_text") val primaryText: String,
    @Json(name = "secondary_text") val secondaryText: String? = null,
    val label: String,
    val text: String? = null,
    /** GeoJSON order: `[longitude, latitude]`. */
    val center: List<Double> = emptyList(),
    val kind: String,
) {
    val longitude: Double? get() = center.getOrNull(0)
    val latitude: Double? get() = center.getOrNull(1)
}

/** `GET /api/geo/autocomplete` envelope. */
@JsonClass(generateAdapter = true)
data class GeoAutocompleteResponse(
    val suggestions: List<GeoSuggestion> = emptyList(),
)

/** `POST /api/geo/resolve` body. */
@JsonClass(generateAdapter = true)
data class GeoResolveRequest(
    @Json(name = "suggestion_id") val suggestionId: String,
)

/** `POST /api/geo/resolve` envelope. */
@JsonClass(generateAdapter = true)
data class GeoResolveResponse(
    val normalized: NormalizedAddress,
)

/**
 * `center` on the place-tagging endpoints — a `{lat, lng}` OBJECT, unlike
 * the legacy autocomplete's GeoJSON `[lng, lat]` array on [GeoSuggestion].
 */
@JsonClass(generateAdapter = true)
data class GeoPlaceCenter(
    val lat: Double,
    val lng: Double,
)

/**
 * One nearby / searched place for Instagram-style post tagging —
 * a Mapbox POI (`kind == "poi"`) or a locality (`kind == "place"`).
 * Wire shape from `GET /api/geo/places/nearby|search`.
 */
@JsonClass(generateAdapter = true)
data class GeoPlace(
    @Json(name = "place_id") val placeId: String? = null,
    val name: String,
    /** e.g. "coffee shop, cafe". */
    val category: String? = null,
    /** Short address line. */
    val address: String? = null,
    @Json(name = "full_address") val fullAddress: String? = null,
    val center: GeoPlaceCenter,
    val kind: String,
    /** Meters from the query point; null when no coords were sent. */
    @Json(name = "distance_m") val distanceM: Double? = null,
)

/** `GET /api/geo/places/nearby` envelope. */
@JsonClass(generateAdapter = true)
data class GeoNearbyPlacesResponse(
    val places: List<GeoPlace> = emptyList(),
    val locality: GeoPlace? = null,
)

/** `GET /api/geo/places/search` envelope. */
@JsonClass(generateAdapter = true)
data class GeoPlaceSearchResponse(
    val places: List<GeoPlace> = emptyList(),
)
