package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.offers.ReceivedOffersResponse
import app.pantopus.android.data.api.models.offers.UpdateBidBody
import app.pantopus.android.data.api.models.offers.WithdrawBidBody
import app.pantopus.android.data.api.models.offers.WithdrawBidResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * T5.2.4 — cross-listing Offers screen + T5.3.1 My bids screen. Both
 * lean on the same gig-bid endpoints; this interface bundles the
 * read + mutation surface a bidder needs.
 */
interface OffersApi {
    /**
     * `GET /api/gigs/my-bids` — route `backend/routes/gigs.js:1253`.
     * Returns bids the current user placed on other people's gigs.
     */
    @GET("api/gigs/my-bids")
    suspend fun myBids(
        @Query("limit") limit: Int = 100,
    ): MyBidsResponse

    /**
     * `GET /api/gigs/received-offers` — route
     * `backend/routes/gigs.js:1469`. Returns bids other people placed
     * on gigs the current user posted (or manages on behalf of a
     * business).
     */
    @GET("api/gigs/received-offers")
    suspend fun receivedOffers(
        @Query("limit") limit: Int = 100,
    ): ReceivedOffersResponse

    /**
     * `PUT /api/gigs/:gigId/bids/:bidId` — route
     * `backend/routes/gigs.js:3971`. Backend only allows updates while
     * the bid is `pending` or `countered`. Used by T5.3.1 Edit-bid.
     */
    @PUT("api/gigs/{gigId}/bids/{bidId}")
    suspend fun updateBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
        @Body body: UpdateBidBody,
    ): UpdateBidResponseEnvelope

    /**
     * `DELETE /api/gigs/:gigId/bids/:bidId` — route
     * `backend/routes/gigs.js:5245`. Retrofit DELETE methods carry
     * bodies via `@HTTP(hasBody = true)`. Backend whitelists the
     * `reason` to one of four enum values.
     */
    @HTTP(method = "DELETE", path = "api/gigs/{gigId}/bids/{bidId}", hasBody = true)
    suspend fun withdrawBid(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
        @Body body: WithdrawBidBody,
    ): WithdrawBidResponse
}

/**
 * `PUT /api/gigs/:gigId/bids/:bidId` envelope. The handler wraps the
 * updated row inside `{ bid: {...} }`.
 */
@com.squareup.moshi.JsonClass(generateAdapter = true)
data class UpdateBidResponseEnvelope(
    val bid: BidDto? = null,
)
