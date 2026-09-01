@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET /api/homes/:id/property-details` — route
 * `backend/routes/home.js:2991`. Only the `home` property fields are
 * modelled; the response's opaque ATTOM payload + `source` /
 * `unavailable_reason` aren't surfaced by the A13.5 screen.
 * Field-for-field parity with iOS `PropertyDetailsDTOs.swift`.
 */

/** Parsed `{ latitude, longitude }` for the property hero map. */
@JsonClass(generateAdapter = true)
data class PropertyLocationDto(
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** The `home` object — only the rendered property fields are modelled. */
@JsonClass(generateAdapter = true)
data class PropertyHomeDto(
    val address: String? = null,
    val address2: String? = null,
    @Json(name = "unit_number") val unitNumber: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipcode: String? = null,
    @Json(name = "zip_code") val zipCode: String? = null,
    val location: PropertyLocationDto? = null,
    @Json(name = "home_type") val homeType: String? = null,
    val bedrooms: Int? = null,
    val bathrooms: Double? = null,
    @Json(name = "sq_ft") val sqFt: Int? = null,
    @Json(name = "lot_sq_ft") val lotSqFt: Int? = null,
    @Json(name = "year_built") val yearBuilt: Int? = null,
)

/** Envelope for `GET /api/homes/:id/property-details`. */
@JsonClass(generateAdapter = true)
data class PropertyDetailsResponse(
    val home: PropertyHomeDto,
)
