@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Body for `POST /api/ai/draft/listing-vision` (A12.9 Snap & Sell).
 * `images` carries base64 data URLs (or hosted URLs), capped at five —
 * mirror of iOS `AIDraftListingVisionRequest`. Route
 * `backend/routes/ai.js:199`.
 */
@JsonClass(generateAdapter = true)
data class AIDraftListingVisionRequest(
    val images: List<String>,
    val text: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
)

/** AI-drafted listing fields. All optional — fill empty form fields only. */
@JsonClass(generateAdapter = true)
data class AIListingDraftDto(
    val title: String? = null,
    val description: String? = null,
    val price: Double? = null,
    val isFree: Boolean? = null,
    val category: String? = null,
    val condition: String? = null,
    val tags: List<String>? = null,
    val listingType: String? = null,
    val deliveryAvailable: Boolean? = null,
    val meetupPreference: String? = null,
)

/** Comparable-sales price band backing the snap-review comp-range track. */
@JsonClass(generateAdapter = true)
data class AIPriceSuggestionDto(
    val low: Double,
    val median: Double,
    val high: Double,
    val basis: String? = null,
    val comparableCount: Int? = null,
)

/** Envelope from `POST /api/ai/draft/listing-vision`. */
@JsonClass(generateAdapter = true)
data class AIListingVisionResponse(
    val draft: AIListingDraftDto,
    val confidence: Double? = null,
    val priceSuggestion: AIPriceSuggestionDto? = null,
)

/**
 * Body for `POST /api/ai/draft/post`. `text` is the free-text prompt
 * (Joi `draftPostSchema` caps it at 2000 chars,
 * `backend/routes/ai.js:81`); `surface` is `"place"` or `"connections"`
 * when set. Mirror of iOS `AIDraftPostRequest`.
 */
@JsonClass(generateAdapter = true)
data class AIDraftPostRequest(
    val text: String,
    val surface: String? = null,
)

/**
 * One AI-drafted post. Mirrors `postDraftJsonSchema`
 * (`backend/services/ai/schemas.js:99`) — `content` is the only key the
 * schema marks required.
 */
@JsonClass(generateAdapter = true)
data class AIPostDraftDto(
    val content: String,
    val title: String? = null,
    val postType: String? = null,
    val purpose: String? = null,
    val visibility: String? = null,
    val tags: List<String>? = null,
)

/** Envelope from `POST /api/ai/draft/post`. */
@JsonClass(generateAdapter = true)
data class AIPostDraftResponse(
    val draft: AIPostDraftDto,
)

/**
 * Body for `POST /api/ai/draft/pickup-schedule`: photos of a hauler's flyer, as
 * the person's own `/api/upload/ai-media` URLs (1–3), or what they wrote. Mirror
 * of iOS `AIDraftPickupScheduleRequest`. Route `backend/routes/ai.js:249`.
 */
@JsonClass(generateAdapter = true)
data class AIDraftPickupScheduleRequest(
    val images: List<String>? = null,
    val text: String? = null,
)

/**
 * The pickup days read from a flyer. A null field keeps the editor's own value;
 * `recyclingNextDate` is already inside the window the save route accepts.
 */
@JsonClass(generateAdapter = true)
data class AIPickupScheduleReadingDto(
    /** `MO`…`SU`. */
    @Json(name = "garbage_weekday") val garbageWeekday: String? = null,
    /** `weekly`, `biweekly`, or `not_set` (the flyer says there is no recycling). */
    @Json(name = "recycling_frequency") val recyclingFrequency: String? = null,
    @Json(name = "recycling_next_date") val recyclingNextDate: String? = null,
    /** "Garbage every Tuesday. Recycling every other Tuesday, next on Tuesday, October 20." */
    val summary: String? = null,
)

/** Envelope from `POST /api/ai/draft/pickup-schedule`. Nothing is saved until the editor's Save. */
@JsonClass(generateAdapter = true)
data class AIDraftPickupScheduleResponse(
    val schedule: AIPickupScheduleReadingDto,
    /** One sentence about what the flyer shows that the editor doesn't keep (yard waste, holidays). */
    val note: String? = null,
)

/**
 * A radon test result read from a photo or PDF of the lab's report, for the Today radon sheet to
 * fill in. Mirror of iOS `AIRadonReportResponse.Result`.
 */
@JsonClass(generateAdapter = true)
data class AIRadonReportResultDto(
    /** The result in pCi/L (converted when the report gave Bq/m³). */
    @Json(name = "value_pci") val valuePci: Double? = null,
    /** The report gave the result as below this limit ("<0.4"). */
    @Json(name = "below_limit") val belowLimit: Boolean? = null,
    /** `YYYY-MM-DD`: the day the test ended. */
    @Json(name = "tested_on") val testedOn: String? = null,
    /** `short_term`, `long_term`, or null when the report doesn't say. */
    @Json(name = "test_kind") val testKind: String? = null,
    /** "Short-term test, October 1 to October 3, 2026: 5.2 pCi/L. From …" */
    val summary: String? = null,
)

/**
 * Envelope from `POST /api/ai/draft/radon-result` (`backend/routes/ai.js:281`). The report isn't
 * kept, and nothing is saved until the person taps the sheet's Save.
 */
@JsonClass(generateAdapter = true)
data class AIRadonReportResponse(
    val result: AIRadonReportResultDto,
    /** One sentence on how the report was read (which of several results, a missing date). */
    val note: String? = null,
)
