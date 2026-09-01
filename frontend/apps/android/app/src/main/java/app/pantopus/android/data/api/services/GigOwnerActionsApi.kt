package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.GigActiveStatusResponse
import app.pantopus.android.data.api.models.gigs.GigBidMutationResponse
import app.pantopus.android.data.api.models.gigs.GigDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatusBody
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatusResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Routes the RN gig detail exercises that had no native call site: the
 * poster withdrawing their own pending counter-offer, the poster closing
 * (deleting) a still-open task, and the urgent-task live fulfillment
 * stepper (read + advance).
 *
 * Kept off [GigsApi] on purpose — that interface is heavily shared and
 * this package touches four unrelated routes.
 */
interface GigOwnerActionsApi {
    /**
     * `POST /api/gigs/:gigId/bids/:bidId/counter/withdraw` — the poster
     * withdraws the pending counter-offer they sent. The backend nulls
     * every `counter_…` column and flips the bid back to `pending`,
     * notifies the bidder (`counter_withdrawn`), and emits a
     * `gig:bid-update` room event. Returns `{ bid }`.
     * Route `backend/routes/gigs.js:5342`.
     */
    @POST("api/gigs/{gigId}/bids/{bidId}/counter/withdraw")
    suspend fun withdrawCounterOffer(
        @Path("gigId") gigId: String,
        @Path("bidId") bidId: String,
    ): GigBidMutationResponse

    /**
     * `DELETE /api/gigs/:id` — the poster closes a still-open task; the
     * row is deleted outright. The backend 403s non-owners and 400s any
     * status other than `open` ("Can only delete open gigs").
     * Returns `{ message }`. Route `backend/routes/gigs.js:3730`.
     */
    @DELETE("api/gigs/{id}")
    suspend fun deleteGig(
        @Path("id") id: String,
    ): GigDeleteResponse

    /**
     * `GET /api/gigs/:gigId/active-status` — current fulfillment status,
     * helper ETA and (when the poster opted into sharing) the helper's
     * last location for an **urgent / starts-asap** task. Poster or
     * assigned worker only; 400s on non-urgent gigs.
     * Route `backend/routes/gigs.js:8810`.
     */
    @GET("api/gigs/{gigId}/active-status")
    suspend fun activeStatus(
        @Path("gigId") gigId: String,
    ): GigActiveStatusResponse

    /**
     * `POST /api/gigs/:gigId/status` — advance the urgent-task
     * fulfillment status. The worker may set `on_the_way` / `arrived` /
     * `picked_up` / `dropped_off`; either party may set `in_progress`.
     * Returns `{ gig, fulfillment_status }` and emits `gig_status_update`
     * into the `gig:<id>` room. Route `backend/routes/gigs.js:8689`.
     */
    @POST("api/gigs/{gigId}/status")
    suspend fun updateFulfillmentStatus(
        @Path("gigId") gigId: String,
        @Body body: GigFulfillmentStatusBody,
    ): GigFulfillmentStatusResponse
}
