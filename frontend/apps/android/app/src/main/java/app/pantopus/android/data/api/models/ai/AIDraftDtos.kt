@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.ai

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
