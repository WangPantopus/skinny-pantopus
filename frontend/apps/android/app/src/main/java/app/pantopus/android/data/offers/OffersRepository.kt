package app.pantopus.android.data.offers

import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.offers.ReceivedOffersResponse
import app.pantopus.android.data.api.models.offers.UpdateBidBody
import app.pantopus.android.data.api.models.offers.WithdrawBidBody
import app.pantopus.android.data.api.models.offers.WithdrawBidResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.OffersApi
import app.pantopus.android.data.api.services.UpdateBidResponseEnvelope
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [OffersApi]. T5.2.4 Offers reads + T5.3.1 My
 * bids reads + mutates (withdraw, edit). The ViewModels own optimistic
 * state and rollback; this layer only marshals the calls.
 */
@Singleton
class OffersRepository
    @Inject
    constructor(
        private val api: OffersApi,
    ) {
        suspend fun myBids(limit: Int = 100): NetworkResult<MyBidsResponse> = safeApiCall { api.myBids(limit) }

        suspend fun receivedOffers(limit: Int = 100): NetworkResult<ReceivedOffersResponse> = safeApiCall { api.receivedOffers(limit) }

        suspend fun updateBid(
            gigId: String,
            bidId: String,
            body: UpdateBidBody,
        ): NetworkResult<UpdateBidResponseEnvelope> = safeApiCall { api.updateBid(gigId, bidId, body) }

        suspend fun withdrawBid(
            gigId: String,
            bidId: String,
            reason: String?,
        ): NetworkResult<WithdrawBidResponse> =
            safeApiCall {
                api.withdrawBid(gigId, bidId, WithdrawBidBody(reason = reason))
            }
    }
