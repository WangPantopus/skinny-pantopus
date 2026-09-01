@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Envelope from `GET /api/gigs/browse` (route `backend/routes/gigs.js:3190`).
 * Gigs in each section ride the raw spatial-RPC row shape (snake_case,
 * `distance_meters`) enriched with `first_image`.
 */
@JsonClass(generateAdapter = true)
data class GigsBrowseResponse(
    val sections: GigsBrowseSectionsDto,
    @Json(name = "total_active") val totalActive: Int? = null,
    @Json(name = "radius_used") val radiusUsed: Int? = null,
)

/** The six pre-built browse sections. Empty lists when a section has no fill. */
@JsonClass(generateAdapter = true)
data class GigsBrowseSectionsDto(
    @Json(name = "best_matches") val bestMatches: List<GigDto> = emptyList(),
    val urgent: List<GigDto> = emptyList(),
    val clusters: List<GigBrowseClusterDto> = emptyList(),
    @Json(name = "high_paying") val highPaying: List<GigDto> = emptyList(),
    @Json(name = "new_today") val newToday: List<GigDto> = emptyList(),
    @Json(name = "quick_jobs") val quickJobs: List<GigDto> = emptyList(),
)

/**
 * One category cluster from the browse `clusters` section
 * (`backend/services/gig/clusterService.js` — categories with 2+ gigs).
 */
@JsonClass(generateAdapter = true)
data class GigBrowseClusterDto(
    val category: String? = null,
    val count: Int? = null,
    @Json(name = "price_min") val priceMin: Double? = null,
    @Json(name = "price_max") val priceMax: Double? = null,
    @Json(name = "price_avg") val priceAvg: Double? = null,
    @Json(name = "nearest_distance") val nearestDistance: Double? = null,
    @Json(name = "newest_at") val newestAt: String? = null,
    @Json(name = "representative_title") val representativeTitle: String? = null,
)

/**
 * Envelope from `GET /api/gigs/price-benchmark` (route
 * `backend/routes/gigs.js:2985`). `benchmark` is null for an unknown
 * category with no regional default.
 */
@JsonClass(generateAdapter = true)
data class PriceBenchmarkResponse(
    val benchmark: PriceBenchmarkDto? = null,
)

/**
 * 25th/50th/75th percentile of completed-gig prices in the category
 * (`backend/services/gig/gigPricingService.js`). `comparableCount == 0`
 * flags the cold-start regional default — the composer hides the hint.
 */
@JsonClass(generateAdapter = true)
data class PriceBenchmarkDto(
    val low: Double? = null,
    val median: Double? = null,
    val high: Double? = null,
    val basis: String? = null,
    @Json(name = "comparable_count") val comparableCount: Int? = null,
    val category: String? = null,
)

/** Body for `POST /api/gigs/:gigId/dismiss` ("Not interested"). */
@JsonClass(generateAdapter = true)
data class DismissGigBody(
    val reason: String? = null,
)

/** Body for `POST /api/gigs/hidden-categories`. */
@JsonClass(generateAdapter = true)
data class HiddenCategoryBody(
    val category: String,
)

/** `{ "success": true }` envelope shared by dismiss / hidden-category mutations. */
@JsonClass(generateAdapter = true)
data class GigActionSuccessResponse(
    val success: Boolean? = null,
)
