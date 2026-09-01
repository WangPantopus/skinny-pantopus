@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.listing_offers.CounterListingOfferBody
import app.pantopus.android.data.api.models.listing_offers.ListingOfferResponseEnvelope
import app.pantopus.android.data.api.models.listing_offers.ListingOffersResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * T5.3.4 — per-listing offers screen. Backend routes live in
 * `backend/routes/listingOffers.js`. Distinct from [GigsApi] which
 * handles the cross-listing gig-bid surface.
 */
interface ListingOffersApi {
    /**
     * `GET /api/listings/:listingId/offers` — route
     * `backend/routes/listingOffers.js:78`. Seller sees every offer;
     * buyer sees only their own.
     */
    @GET("api/listings/{listingId}/offers")
    suspend fun listOffers(
        @Path("listingId") listingId: String,
    ): ListingOffersResponse

    /**
     * `POST /api/listings/:listingId/offers/:offerId/accept` — route
     * `backend/routes/listingOffers.js:163`.
     */
    @POST("api/listings/{listingId}/offers/{offerId}/accept")
    suspend fun acceptOffer(
        @Path("listingId") listingId: String,
        @Path("offerId") offerId: String,
    ): ListingOfferResponseEnvelope

    /**
     * `POST /api/listings/:listingId/offers/:offerId/decline` — route
     * `backend/routes/listingOffers.js:180`.
     */
    @POST("api/listings/{listingId}/offers/{offerId}/decline")
    suspend fun declineOffer(
        @Path("listingId") listingId: String,
        @Path("offerId") offerId: String,
    ): ListingOfferResponseEnvelope

    /**
     * `POST /api/listings/:listingId/offers/:offerId/counter` — route
     * `backend/routes/listingOffers.js:144`.
     */
    @POST("api/listings/{listingId}/offers/{offerId}/counter")
    suspend fun counterOffer(
        @Path("listingId") listingId: String,
        @Path("offerId") offerId: String,
        @Body body: CounterListingOfferBody,
    ): ListingOfferResponseEnvelope
}
