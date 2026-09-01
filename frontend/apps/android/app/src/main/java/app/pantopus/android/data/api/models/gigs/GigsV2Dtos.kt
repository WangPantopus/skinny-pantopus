package app.pantopus.android.data.api.models.gigs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

/**
 * Wire shapes for the Gigs "v2" surfaces:
 *
 * - `POST /api/gigs/:gigId/share-status`  — `backend/routes/gigsV2.js:244`
 * - `GET  /api/v2/gigs/:gigId/offers`     — `backend/routes/offersV2.js:47`
 * - `GET  /api/activities/support-trains/nearby` —
 *   `backend/routes/supportTrains.js:570`, which answers straight from the
 *   `list_support_trains_nearby` RPC whose rows are keyed
 *   `support_train_id` (not `id`).
 */

// ── Share live status ────────────────────────────────────────────────

/**
 * `POST /api/gigs/:gigId/share-status` response. `share_url` is
 * `${APP_URL}/status/<token>`; `expires_at` is 24h out.
 */
@JsonClass(generateAdapter = true)
data class GigShareStatusResponse(
    @Json(name = "share_url") val shareUrl: String,
    @Json(name = "expires_at") val expiresAt: String? = null,
)

// ── Scored offers (v2) ───────────────────────────────────────────────

/** `GET /api/v2/gigs/:gigId/offers` envelope. */
@JsonClass(generateAdapter = true)
data class GigScoredOffersResponse(
    val offers: List<GigScoredOfferDto> = emptyList(),
)

/**
 * One ranked offer. The bid half mirrors [GigBidDto]; the ranking half
 * (`match_score` / `match_rank` / `is_recommended`) plus the trust capsule
 * are what the v2 endpoint adds over `GET /:gigId/bids`.
 */
@JsonClass(generateAdapter = true)
data class GigScoredOfferDto(
    val id: String,
    @Json(name = "gig_id") val gigId: String? = null,
    @Json(name = "user_id") val userId: String? = null,
    val price: Double? = null,
    val amount: Double? = null,
    val message: String? = null,
    val availability: String? = null,
    val status: String? = null,
    @Json(name = "created_at") val createdAt: String? = null,
    val bidder: GigCreator? = null,
    @Json(name = "match_score") val matchScore: Double? = null,
    @Json(name = "match_rank") val matchRank: Int? = null,
    @Json(name = "is_recommended") val isRecommended: Boolean? = null,
    @Json(name = "trust_capsule") val trustCapsule: GigOfferTrustCapsuleDto? = null,
) {
    /**
     * The offer projected onto the shared bid shape the owner bids panel
     * already renders, so accept / counter / reject stay unchanged.
     */
    fun asBid(): GigBidDto =
        GigBidDto(
            id = id,
            userId = userId,
            bidAmount = amount ?: price,
            amount = amount ?: price,
            status = status,
            message = message,
            createdAt = createdAt,
            bidder = bidder,
        )
}

/** Trust signals the v2 endpoint attaches to every offer. */
@JsonClass(generateAdapter = true)
data class GigOfferTrustCapsuleDto(
    val verified: Boolean? = null,
    @Json(name = "first_name") val firstName: String? = null,
    @Json(name = "average_rating") val averageRating: Double? = null,
    @Json(name = "review_count") val reviewCount: Int? = null,
    @Json(name = "reliability_score") val reliabilityScore: Double? = null,
    @Json(name = "gigs_completed") val gigsCompleted: Int? = null,
    @Json(name = "distance_miles") val distanceMiles: Double? = null,
)

// ── Nearby Support Trains (Tasks-feed scope segmentation) ────────────

/** `GET /api/activities/support-trains/nearby` envelope (RPC row shape). */
@JsonClass(generateAdapter = true)
data class GigsFeedNearbyTrainsResponse(
    @Json(name = "support_trains") val supportTrains: List<GigsFeedNearbyTrainDto> = emptyList(),
)

/** One nearby Support Train row for the Tasks feed. */
@JsonClass(generateAdapter = true)
data class GigsFeedNearbyTrainDto(
    @Json(name = "support_train_id") val supportTrainId: String,
    @Json(name = "activity_id") val activityId: String? = null,
    val title: String? = null,
    val status: String? = null,
    @Json(name = "published_at") val publishedAt: String? = null,
    @Json(name = "distance_meters") val distanceMeters: Double? = null,
    @Json(name = "open_slots_count") val openSlotsCount: Int? = null,
    val city: String? = null,
    val state: String? = null,
)
