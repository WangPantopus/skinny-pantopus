package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigActiveStatusResponse
import app.pantopus.android.data.api.models.gigs.GigBidMutationResponse
import app.pantopus.android.data.api.models.gigs.GigDeleteResponse
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatus
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatusBody
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatusResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigOwnerActionsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Poster-side gig actions that had no native call site before: withdraw a
 * counter-offer, close a still-open task, and drive the urgent-task live
 * fulfillment stepper. Kept off [GigsRepository] so the four routes land
 * in one small, self-contained surface.
 */
@Singleton
class GigOwnerActionsRepository
    @Inject
    constructor(
        private val api: GigOwnerActionsApi,
    ) {
        /** `POST .../counter/withdraw` — poster pulls back their counter-offer. */
        suspend fun withdrawCounterOffer(
            gigId: String,
            bidId: String,
        ): NetworkResult<GigBidMutationResponse> = safeApiCall { api.withdrawCounterOffer(gigId, bidId) }

        /** `DELETE /api/gigs/:id` — poster closes a still-open task (row is deleted). */
        suspend fun deleteGig(id: String): NetworkResult<GigDeleteResponse> = safeApiCall { api.deleteGig(id) }

        /** `GET /api/gigs/:gigId/active-status` — urgent-task live status. */
        suspend fun activeStatus(gigId: String): NetworkResult<GigActiveStatusResponse> = safeApiCall { api.activeStatus(gigId) }

        /** `POST /api/gigs/:gigId/status` — advance the urgent-task fulfillment status. */
        suspend fun updateFulfillmentStatus(
            gigId: String,
            status: GigFulfillmentStatus,
            helperEtaMinutes: Int? = null,
        ): NetworkResult<GigFulfillmentStatusResponse> =
            safeApiCall {
                api.updateFulfillmentStatus(
                    gigId,
                    GigFulfillmentStatusBody(status = status.wire, helperEtaMinutes = helperEtaMinutes),
                )
            }
    }
