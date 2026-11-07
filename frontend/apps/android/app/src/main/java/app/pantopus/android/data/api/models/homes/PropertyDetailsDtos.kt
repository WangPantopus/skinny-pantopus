@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.homes

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * DTOs for `GET /api/homes/:id/property-details` — route
 * `backend/routes/home.js:1949`. The `home` property fields and the
 * verified owner's `county_record` (the county record as labeled sections)
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
 * `county_record`: the verified owner's county record as labeled sections,
 * worded and formatted by `backend/serializers/countyRecordSerializer.js`.
 */
@JsonClass(generateAdapter = true)
data class PropertyCountyRecordDto(
    val sections: List<PropertyRecordSectionDto> = emptyList(),
    /** Names the source and date: "From Clark County Assessor's weekly file · updated Oct 31, 2026". */
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
    /** Where this row came from, when it isn't the footer's source ("From your household"). */
    val tag: String? = null,
    /** What stands beside it ("County record: 3"). */
    val note: String? = null,
)

/** The county's own property page, where a person can check a fact and come back to confirm it. */
@JsonClass(generateAdapter = true)
data class HouseholdCountyPageDto(
    val url: String,
    val label: String,
)

/** One one-tap answer. */
@JsonClass(generateAdapter = true)
data class HouseholdAnswerDto(
    val label: String,
    val value: String,
)

/** "Bedrooms? 1 2 3 4 Other": a tap answers it. */
@JsonClass(generateAdapter = true)
data class HouseholdQuestionDto(
    val key: String,
    val prompt: String,
    val options: List<HouseholdAnswerDto> = emptyList(),
    val other: String = "Other",
)

/** One fact in "Fix something" or "Add details", as the server words it. */
@JsonClass(generateAdapter = true)
data class HouseholdFactDto(
    val key: String,
    val label: String,
    /** What the page shows now. */
    val value: String? = null,
    /** What the field starts with. */
    val current: String = "",
    /** "County record: 3", when the household's value differs from it. */
    val note: String? = null,
    /** `number`, `decimal`, `year` or `text`. */
    val input: String = "text",
    val unit: String? = null,
    val options: List<HouseholdAnswerDto> = emptyList(),
    @Json(name = "can_undo") val canUndo: Boolean = false,
)

/**
 * What someone who can edit may do with one group of facts. `sectionId` is the card it sits under;
 * with none it is a card of its own.
 */
@JsonClass(generateAdapter = true)
data class HouseholdGroupDto(
    val id: String,
    @Json(name = "section_id") val sectionId: String? = null,
    val title: String,
    val lead: String? = null,
    val prompt: String? = null,
    val confirmed: String? = null,
    val fix: String? = null,
    val facts: List<HouseholdFactDto> = emptyList(),
    val report: String? = null,
    val reported: String? = null,
)

/**
 * What the household has said and can say (`backend/services/householdFacts.js`). Controls appear
 * only when the server sends what they need.
 */
@JsonClass(generateAdapter = true)
data class HouseholdPartDto(
    @Json(name = "can_edit") val canEdit: Boolean = false,
    val sections: List<PropertyRecordSectionDto> = emptyList(),
    val groups: List<HouseholdGroupDto> = emptyList(),
    val questions: List<HouseholdQuestionDto> = emptyList(),
    @Json(name = "county_page") val countyPage: HouseholdCountyPageDto? = null,
)

/** One change to the household's facts: a fact by `key`, or every fact of a `group` that can take it. */
@JsonClass(generateAdapter = true)
data class HouseholdFactChange(
    val key: String? = null,
    val group: String? = null,
    val action: String,
    val value: String? = null,
) {
    companion object {
        fun correct(
            key: String,
            value: String,
        ) = HouseholdFactChange(key = key, action = "correct", value = value)

        fun undo(key: String) = HouseholdFactChange(key = key, action = "undo")

        fun confirm(group: String) = HouseholdFactChange(group = group, action = "confirm")

        fun undoConfirm(group: String) = HouseholdFactChange(group = group, action = "undo")
    }
}

/** Body of `PATCH /api/homes/:id` for the household's facts. */
@JsonClass(generateAdapter = true)
data class HouseholdFactsRequest(
    @Json(name = "household_facts") val householdFacts: List<HouseholdFactChange>,
)

/** Body of `POST /api/homes/:id/record-problem`. */
@JsonClass(generateAdapter = true)
data class RecordProblemRequest(
    val section: String,
    val field: String? = null,
    val note: String? = null,
)

/** What the household's writes answer: the screen reads again rather than use it. */
@JsonClass(generateAdapter = true)
data class HouseholdWriteResponse(
    val message: String? = null,
)

/** Envelope for `GET /api/homes/:id/property-details`. */
@JsonClass(generateAdapter = true)
data class PropertyDetailsResponse(
    val home: PropertyHomeDto,
    /** The county record; the server sends it to verified owners only. */
    @Json(name = "county_record") val countyRecord: PropertyCountyRecordDto? = null,
    /** What the household has said and can say; only for those it's meant for. */
    val household: HouseholdPartDto? = null,
)
