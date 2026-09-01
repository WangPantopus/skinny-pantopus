package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.ReopenBiddingBody
import app.pantopus.android.data.api.models.gigs.ReopenBiddingResponse
import app.pantopus.android.data.api.models.gigs.WorkerReleaseBody
import app.pantopus.android.data.api.models.gigs.WorkerReleaseResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigReassignmentApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Pre-start release of an assigned gig: the poster swaps the worker out
 * (`reopen-bidding`) or the worker steps aside (`worker-release`). Both
 * release the payment hold and put the task back to `open`.
 */
@Singleton
class GigReassignmentRepository
    @Inject
    constructor(
        private val api: GigReassignmentApi,
    ) {
        /** `POST /api/gigs/:gigId/reopen-bidding` — poster replaces the worker. */
        suspend fun reopenBidding(gigId: String): NetworkResult<ReopenBiddingResponse> =
            safeApiCall { api.reopenBidding(gigId, ReopenBiddingBody()) }

        /** `POST /api/gigs/:gigId/worker-release` — assigned worker steps aside. */
        suspend fun workerRelease(
            gigId: String,
            note: String? = null,
        ): NetworkResult<WorkerReleaseResponse> = safeApiCall { api.workerRelease(gigId, WorkerReleaseBody(note = note)) }
    }
