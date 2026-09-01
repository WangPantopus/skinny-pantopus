package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.gigs.ReopenBiddingBody
import app.pantopus.android.data.api.models.gigs.ReopenBiddingResponse
import app.pantopus.android.data.api.models.gigs.WorkerReleaseBody
import app.pantopus.android.data.api.models.gigs.WorkerReleaseResponse
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * The two "this assignment isn't going to happen" exits an assigned gig
 * has before work starts. Both unassign the worker, cancel the
 * pre-capture payment hold, and move the gig back to `open` for new bids
 * — neither is a cancellation and neither charges a cancellation fee.
 * Mounted at `/api/gigs` (`backend/app.js:309`).
 */
interface GigReassignmentApi {
    /**
     * `POST /api/gigs/:gigId/reopen-bidding` — the poster unassigns the
     * current worker and reopens the task for bids. Preconditions
     * (`backend/routes/gigs.js:4874`): the caller holds `gigs.manage` on
     * the gig owner, `status == "assigned"`, `started_at` is null, and any
     * linked payment is still pre-capture.
     */
    @POST("api/gigs/{gigId}/reopen-bidding")
    suspend fun reopenBidding(
        @Path("gigId") gigId: String,
        @Body body: ReopenBiddingBody,
    ): ReopenBiddingResponse

    /**
     * `POST /api/gigs/:gigId/worker-release` — the assigned worker
     * releases themselves ("Can't make it"). Preconditions
     * (`backend/routes/gigs.js:5954`): the caller is `accepted_by`,
     * `status == "assigned"`, `started_at` is null. Releases the hold,
     * rejects the accepted bid, reopens the gig, notifies the poster.
     */
    @POST("api/gigs/{gigId}/worker-release")
    suspend fun workerRelease(
        @Path("gigId") gigId: String,
        @Body body: WorkerReleaseBody,
    ): WorkerReleaseResponse
}
