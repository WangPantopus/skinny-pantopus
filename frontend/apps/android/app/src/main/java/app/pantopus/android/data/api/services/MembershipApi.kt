package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.membership.MembershipRefundRequestBody
import app.pantopus.android.data.api.models.membership.MembershipTierChangeBody
import app.pantopus.android.data.api.models.membership.PersonaMembershipResponse
import app.pantopus.android.data.api.models.membership.PersonaPublicTiersResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * A10.8 fan-side membership. Backs the membership manage screen. Backend
 * keeps the persona / membership names on the wire; the UI renames at the VM
 * boundary. Mounted at `/api/personas/:id/membership` (`backend/app.js:367`).
 */
interface MembershipApi {
    /** `GET /api/personas/:id/membership` — the calling fan's own membership.
     *  Route `backend/routes/personaMembership.js:108`. */
    @GET("api/personas/{id}/membership")
    suspend fun membership(
        @Path("id") personaId: String,
    ): PersonaMembershipResponse

    /** `POST /api/personas/:id/membership/cancel` — no-charge cancel (free
     *  cancels immediately, paid flips `cancel_at_period_end`). Route
     *  `backend/routes/personaMembership.js:204`. */
    @POST("api/personas/{id}/membership/cancel")
    suspend fun cancel(
        @Path("id") personaId: String,
    ): PersonaMembershipResponse

    /** `POST /api/personas/:id/membership/upgrade` — move to a HIGHER tier
     *  rank. Takes effect immediately (Stripe prorates the open invoice).
     *  Route `backend/routes/personaMembership.js:121`. */
    @POST("api/personas/{id}/membership/upgrade")
    suspend fun upgrade(
        @Path("id") personaId: String,
        @Body body: MembershipTierChangeBody,
    ): PersonaMembershipResponse

    /** `POST /api/personas/:id/membership/downgrade` — move to a LOWER tier
     *  rank. Scheduled via `subscriptionSchedule`, so it lands at
     *  `current_period_end` and the fan keeps their current perks until
     *  then. Route `backend/routes/personaMembership.js:162`. */
    @POST("api/personas/{id}/membership/downgrade")
    suspend fun downgrade(
        @Path("id") personaId: String,
        @Body body: MembershipTierChangeBody,
    ): PersonaMembershipResponse

    /** `POST /api/personas/:id/membership/refund-request` — SLA-missed
     *  refund. The backend re-checks that one of the fan's threads is
     *  genuinely in `sla_missed`, issues a prorated refund, then cancels at
     *  period end. Route `backend/routes/personaMembership.js:251`. */
    @POST("api/personas/{id}/membership/refund-request")
    suspend fun refundRequest(
        @Path("id") personaId: String,
        @Body body: MembershipRefundRequestBody,
    ): PersonaMembershipResponse

    /** `GET /api/personas/:handle/tiers` — the public tier ladder the
     *  change-tier picker offers. Addressed by HANDLE, not id (the
     *  UUID-gated routers fall through for handle-shaped URLs). Route
     *  `backend/routes/personas.js:1111`. */
    @GET("api/personas/{handle}/tiers")
    suspend fun publicTiers(
        @Path("handle") handle: String,
    ): PersonaPublicTiersResponse
}
