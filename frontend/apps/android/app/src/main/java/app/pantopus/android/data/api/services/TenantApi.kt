package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.tenant.TenantMoveOutRequest
import app.pantopus.android.data.api.models.tenant.TenantMoveOutResponse
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalRequest
import app.pantopus.android.data.api.models.tenant.TenantRequestApprovalResponse
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Tenant-side landlord flows. `backend/routes/landlordTenant.js` is
 * mounted at `/api/v1` (`backend/app.js:397`), so the tenant routes
 * resolve to `/api/v1/tenant/…`.
 *
 * NOTE: the RN client also calls `GET /api/v1/tenant/home/:id/status`
 * and `POST /api/v1/tenant/request/:leaseId/cancel`. Neither route
 * exists in `backend/routes/landlordTenant.js` today (the only
 * `/tenant/…` declarations are `request-approval` :483,
 * `accept-invite` :601 and `move-out` :643), so they are deliberately
 * absent here rather than stubbed with fixture data.
 */
interface TenantApi {
    /**
     * `POST /api/v1/tenant/request-approval` — route
     * `backend/routes/landlordTenant.js:483`. Creates a pending
     * `HomeLease` addressed to the home's verified landlord authority.
     *
     * Known non-2xx answers the caller should branch on:
     *  - 400 "This property has no verified landlord…" (:515)
     *  - 409 "You already have a pending request for this home" (:527)
     *  - 409 "You already have an active lease at this home" (:540)
     */
    @POST("api/v1/tenant/request-approval")
    suspend fun requestApproval(
        @Body body: TenantRequestApprovalRequest,
    ): TenantRequestApprovalResponse

    /**
     * `POST /api/v1/tenant/move-out` — route
     * `backend/routes/landlordTenant.js:643`. Ends the caller's own
     * active lease.
     */
    @POST("api/v1/tenant/move-out")
    suspend fun moveOut(
        @Body body: TenantMoveOutRequest,
    ): TenantMoveOutResponse
}
