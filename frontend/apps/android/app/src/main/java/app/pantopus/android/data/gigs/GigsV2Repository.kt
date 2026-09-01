package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigScoredOffersResponse
import app.pantopus.android.data.api.models.gigs.GigShareStatusResponse
import app.pantopus.android.data.api.models.gigs.GigsFeedNearbyTrainsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigsV2Api
import javax.inject.Inject
import javax.inject.Singleton

/** Thin wrapper around [GigsV2Api]. */
@Singleton
class GigsV2Repository
    @Inject
    constructor(
        private val api: GigsV2Api,
    ) {
        /** `POST /api/gigs/:gigId/share-status` — 24h public status link. */
        suspend fun shareStatus(gigId: String): NetworkResult<GigShareStatusResponse> = safeApiCall { api.shareStatus(gigId) }

        /** `GET /api/v2/gigs/:gigId/offers` — owner-only ranked offers. */
        suspend fun scoredOffers(gigId: String): NetworkResult<GigScoredOffersResponse> = safeApiCall { api.scoredOffers(gigId) }

        /** `GET /api/activities/support-trains/nearby` — Tasks-feed rows. */
        suspend fun nearbySupportTrains(
            latitude: Double,
            longitude: Double,
            radiusMeters: Double? = null,
            limit: Int = DEFAULT_NEARBY_LIMIT,
        ): NetworkResult<GigsFeedNearbyTrainsResponse> = safeApiCall { api.nearbySupportTrains(latitude, longitude, radiusMeters, limit) }

        companion object {
            /** Mirrors RN's `listNearbySupportTrains({ limit: 50 })`. */
            const val DEFAULT_NEARBY_LIMIT = 50
        }
    }
