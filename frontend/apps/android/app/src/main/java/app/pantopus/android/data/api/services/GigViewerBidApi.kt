package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.GigMyBidResponse
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * The *bidder's own* view of a bid on the gig-detail screen.
 *
 * The poster-side bid routes (list, accept, counter, reject) live on
 * [GigsApi], and update / withdraw live on [OffersApi] — this interface adds
 * only the route nothing else called: "does the signed-in viewer already
 * have a bid on this gig?".
 */
interface GigViewerBidApi {
    /**
     * `GET /api/gigs/:id/my-bid` — route `backend/routes/gigs.js:7882`.
     *
     * Returns `{ bid: null }` when the viewer has not bid. The handler
     * selects a narrow column set (`id, gig_id, user_id, bid_amount,
     * message, proposed_time, status, created_at, updated_at`) and
     * normalises `assigned` to `accepted`. It does **not** return the
     * counter columns, so a `countered` bid is enriched from
     * `GET /api/gigs/my-bids` (`backend/routes/gigs.js:1452`), which does.
     */
    @GET("api/gigs/{gigId}/my-bid")
    suspend fun myBid(
        @Path("gigId") gigId: String,
    ): GigMyBidResponse
}
