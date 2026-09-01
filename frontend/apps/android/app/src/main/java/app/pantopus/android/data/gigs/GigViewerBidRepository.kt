package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigMyBidResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigViewerBidApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [GigViewerBidApi]. The mutation half of the viewer's
 * bid deliberately reuses what already exists:
 * `OffersRepository.updateBid` / `.withdrawBid` for
 * `PUT` and `DELETE .../bids/:bidId`, and
 * `GigsRepository.acceptCounterOffer` / `.declineCounterOffer` for the
 * counter round-trip.
 */
@Singleton
class GigViewerBidRepository
    @Inject
    constructor(
        private val api: GigViewerBidApi,
    ) {
        /** `GET /api/gigs/:id/my-bid` — the viewer's own bid, or null. */
        suspend fun myBid(gigId: String): NetworkResult<GigMyBidResponse> = safeApiCall { api.myBid(gigId) }
    }
