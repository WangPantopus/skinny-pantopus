package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businessfounding.FoundingOfferStatusDto
import app.pantopus.android.data.api.models.businessfounding.FoundingSlotClaimDto
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * First-50 "Founding Business" offer. The owner dashboard reads the global
 * slot status on load and an eligible owner claims a numbered slot from the
 * banner (RN `src/app/businesses/[id]/index.tsx` lines 108-144).
 *
 * Mirrors iOS `BusinessFoundingEndpoints.swift`.
 */
interface BusinessFoundingApi {
    /** `GET /api/businesses/founding-offer/status` — global slot
     *  availability plus the caller's already-claimed businesses.
     *  Route `backend/routes/businessFounding.js:29`; mounted before the
     *  `/:businessId` catch-all so the static path wins
     *  (`backend/app.js:345`). */
    @GET("api/businesses/founding-offer/status")
    suspend fun foundingOfferStatus(): FoundingOfferStatusDto

    /** `POST /api/businesses/:businessId/founding-offer/claim` — claim a
     *  numbered founding slot. Owner-only; 400 when the page isn't
     *  published or verification is below `document_verified`, 409 when
     *  already claimed or all 50 slots are gone.
     *  Route `backend/routes/businessFounding.js:98`. */
    @POST("api/businesses/{businessId}/founding-offer/claim")
    suspend fun claimFoundingOffer(
        @Path("businessId") businessId: String,
    ): FoundingSlotClaimDto
}
