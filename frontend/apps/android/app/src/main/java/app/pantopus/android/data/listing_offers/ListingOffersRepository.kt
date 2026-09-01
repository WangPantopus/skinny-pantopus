@file:Suppress("PackageNaming")

package app.pantopus.android.data.listing_offers

import app.pantopus.android.data.api.models.listing_offers.CounterListingOfferBody
import app.pantopus.android.data.api.models.listing_offers.ListingOfferResponseEnvelope
import app.pantopus.android.data.api.models.listing_offers.ListingOffersResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ListingOffersApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Wraps the per-listing offer routes under `/api/listings/:listingId/offers`
 * in the [NetworkResult] taxonomy. Mirrors the iOS
 * `ListingOffersEndpoints` helper.
 */
@Singleton
class ListingOffersRepository
    @Inject
    constructor(
        private val api: ListingOffersApi,
    ) {
        suspend fun listOffers(listingId: String): NetworkResult<ListingOffersResponse> = safeApiCall { api.listOffers(listingId) }

        suspend fun accept(
            listingId: String,
            offerId: String,
        ): NetworkResult<ListingOfferResponseEnvelope> = safeApiCall { api.acceptOffer(listingId, offerId) }

        suspend fun decline(
            listingId: String,
            offerId: String,
        ): NetworkResult<ListingOfferResponseEnvelope> = safeApiCall { api.declineOffer(listingId, offerId) }

        suspend fun counter(
            listingId: String,
            offerId: String,
            amount: Double,
            message: String?,
        ): NetworkResult<ListingOfferResponseEnvelope> =
            safeApiCall {
                api.counterOffer(
                    listingId = listingId,
                    offerId = offerId,
                    body = CounterListingOfferBody(counterAmount = amount, counterMessage = message),
                )
            }
    }
