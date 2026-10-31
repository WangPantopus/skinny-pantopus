@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET /api/homes/:id/property-details` — route
 * `backend/routes/home.js:1949`. The `home` property fields and the
 * verified owner's `county_record` (the ATTOM record as labeled sections)
 * are modelled; the raw ATTOM payload + `source` / `unavailable_reason`
 * aren't surfaced by the A13.5 screen.
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

/**
 * `county_record`: the verified owner's ATTOM record as labeled sections,
 * worded and formatted by `backend/serializers/countyRecordSerializer.js`.
 */
@JsonClass(generateAdapter = true)
data class PropertyCountyRecordDto(
    val sections: List<PropertyRecordSectionDto> = emptyList(),
    /** "From county records via ATTOM · updated Sep 28, 2026". */
    val footer: String? = null,
)

/** One titled card of record rows (Building, Lot, Value…). */
@JsonClass(generateAdapter = true)
data class PropertyRecordSectionDto(
    val id: String,
    val title: String,
    val rows: List<PropertyRecordRowDto> = emptyList(),
    /** Caption under the card, e.g. the value estimate's "isn't an appraisal". */
    val note: String? = null,
)

/** One label / value row, shown as the server words it. */
@JsonClass(generateAdapter = true)
data class PropertyRecordRowDto(
    val id: String,
    val label: String,
    val value: String,
    /** Numbers, measurements and codes render monospaced. */
    val mono: Boolean? = null,
)

/** Envelope for `GET /api/homes/:id/property-details`. */
@JsonClass(generateAdapter = true)
data class PropertyDetailsResponse(
    val home: PropertyHomeDto,
    /** The county record; the server sends it to verified owners only. */
    @Json(name = "county_record") val countyRecord: PropertyCountyRecordDto? = null,
)
