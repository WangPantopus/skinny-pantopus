package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.HomeOwnershipSecurityResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityRequest
import app.pantopus.android.data.api.models.homes.UpdateHomeOwnershipSecurityResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path

/**
 * Per-home ownership security policy from `backend/routes/homeOwnership.js`
 * (mounted at `/api/homes` — `backend/app.js:322`).
 */
interface HomeOwnershipSecurityApi {
    /**
     * `GET /api/homes/:id/security` — route
     * `backend/routes/homeOwnership.js:1701`. Requires the
     * `security.manage` permission; 403s otherwise.
     */
    @GET("api/homes/{id}/security")
    suspend fun getSecurity(
        @Path("id") homeId: String,
    ): HomeOwnershipSecurityResponse

    /**
     * `PATCH /api/homes/:id/security` — route
     * `backend/routes/homeOwnership.js:1751`. A multi-owner home may
     * answer `{ pending: true, quorum_action_id, message }` instead of
     * applying the change.
     */
    @PATCH("api/homes/{id}/security")
    suspend fun updateSecurity(
        @Path("id") homeId: String,
        @Body body: UpdateHomeOwnershipSecurityRequest,
    ): UpdateHomeOwnershipSecurityResponse
}
