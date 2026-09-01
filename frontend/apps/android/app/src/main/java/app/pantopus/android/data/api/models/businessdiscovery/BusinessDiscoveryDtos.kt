package app.pantopus.android.data.api.models.businessdiscovery

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/** `GET /api/businesses/search` response (subset). */
@JsonClass(generateAdapter = true)
data class BusinessDiscoverySearchResponse(
    @Json(name = "results") val results: List<BusinessDiscoveryItem>,
    @Json(name = "pagination") val pagination: Pagination,
    @Json(name = "sort") val sort: String? = null,
    @Json(name = "sort_label") val sortLabel: String? = null,
    @Json(name = "banner") val banner: String? = null,
) {
    @JsonClass(generateAdapter = true)
    data class Pagination(
        @Json(name = "page") val page: Int,
        @Json(name = "page_size") val pageSize: Int,
        @Json(name = "total_count") val totalCount: Int,
        @Json(name = "total_pages") val totalPages: Int,
        @Json(name = "has_more") val hasMore: Boolean,
    )
}

/**
 * One business row. Subset of the server's `formatSearchResult`
 * projection (`backend/routes/businessDiscovery.js:231`) — only the
 * fields the row renderer needs.
 */
@JsonClass(generateAdapter = true)
data class BusinessDiscoveryItem(
    @Json(name = "business_user_id") val businessUserId: String,
    @Json(name = "username") val username: String? = null,
    @Json(name = "name") val name: String,
    @Json(name = "profile_picture_url") val profilePictureUrl: String? = null,
    @Json(name = "categories") val categories: List<String> = emptyList(),
    @Json(name = "description") val description: String? = null,
    @Json(name = "business_type") val businessType: String? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    @Json(name = "review_count") val reviewCount: Int = 0,
    @Json(name = "distance_miles") val distanceMiles: Double = 0.0,
    @Json(name = "is_open_now") val isOpenNow: Boolean? = null,
    @Json(name = "is_new_business") val isNewBusiness: Boolean = false,
    @Json(name = "city") val city: String? = null,
    @Json(name = "state") val state: String? = null,
    @Json(name = "verification_status") val verificationStatus: String? = null,
    @Json(name = "verification_badge") val verificationBadge: String? = null,
    @Json(name = "founding_badge") val foundingBadge: Boolean? = null,
)
