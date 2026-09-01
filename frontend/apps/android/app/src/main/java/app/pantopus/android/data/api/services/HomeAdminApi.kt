package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.homes.ChangeMemberRoleRequest
import app.pantopus.android.data.api.models.homes.ChangeMemberRoleResponse
import app.pantopus.android.data.api.models.homes.DeleteHomeResponse
import app.pantopus.android.data.api.models.homes.HomeAccessDto
import app.pantopus.android.data.api.models.homes.HomeAuditLogResponse
import app.pantopus.android.data.api.models.homes.HomeVerificationAccessDto
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestActionResponse
import app.pantopus.android.data.api.models.homes.HouseholdAccessRequestsResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Owner / admin-only home administration routes: deleting a home,
 * changing a member's role, and reviewing household-access requests
 * raised by the claim flow's "ask a verified owner" path.
 *
 * Kept separate from [HomesApi] / [HomeMembersApi] so this surface owns
 * its own service; all three share the Retrofit instance provided by
 * `di/NetworkModule.kt`.
 */
interface HomeAdminApi {
    /**
     * `DELETE /api/homes/:id` — route `backend/routes/home.js:3191`.
     *
     * Primary-owner only (`canUserDeleteHomeRecord`); other members get
     * `403 DELETE_HOME_NOT_PRIMARY` and should leave the home instead.
     * `GET /api/homes/my-homes` pre-computes the same predicate as
     * `can_delete_home`, so the UI gates the affordance on that flag.
     */
    @DELETE("api/homes/{id}")
    suspend fun deleteHome(
        @Path("id") homeId: String,
    ): DeleteHomeResponse

    /**
     * `GET /api/homes/:id/me` — route `backend/routes/homeIam.js:51`.
     *
     * The viewer's own access record: `is_owner`, `role_base`, the five
     * `can_manage_*` navigation booleans, and the raw `permissions[]`.
     */
    @GET("api/homes/{id}/me")
    suspend fun myAccess(
        @Path("id") homeId: String,
    ): HomeAccessDto

    /**
     * `GET /api/homes/:id/me` — same route
     * (`backend/routes/homeIam.js:51`), decoded into the
     * verification-facing slice the Verification Center branches on:
     * `verification_status`, the challenge window, and the pending
     * postcard's expiry.
     */
    @GET("api/homes/{id}/me")
    suspend fun myVerificationAccess(
        @Path("id") homeId: String,
    ): HomeVerificationAccessDto

    /**
     * `GET /api/homes/:id/audit-log` — route
     * `backend/routes/homeIam.js:602`.
     *
     * Who did what to the household, newest first. Requires
     * `members.manage` (403 otherwise), joins the actor `User` row, and
     * responds `{ entries }`. `limit` / `offset` default to 50 / 0
     * server-side; we send them so the page size is stable.
     */
    @GET("api/homes/{id}/audit-log")
    suspend fun auditLog(
        @Path("id") homeId: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
    ): HomeAuditLogResponse

    /**
     * `POST /api/homes/:id/members/:userId/role` — route
     * `backend/routes/homeIam.js:212`.
     *
     * Accepts `preset_key` or `role_base`; we send `role_base` from the
     * backend's `ROLE_RANK` vocabulary
     * (`backend/utils/homePermissions.js:31`). Requires `members.manage`
     * and enforces rank — a non-owner may only assign roles strictly
     * below their own, and only an owner may promote to owner.
     */
    @POST("api/homes/{id}/members/{userId}/role")
    suspend fun changeMemberRole(
        @Path("id") homeId: String,
        @Path("userId") userId: String,
        @Body body: ChangeMemberRoleRequest,
    ): ChangeMemberRoleResponse

    /**
     * `GET /api/homes/:id/household-access-requests` — route
     * `backend/routes/home.js:2671`. `status` defaults to `pending`
     * server-side; pass `all` to include resolved rows.
     */
    @GET("api/homes/{id}/household-access-requests")
    suspend fun householdAccessRequests(
        @Path("id") homeId: String,
        @Query("status") status: String = "pending",
    ): HouseholdAccessRequestsResponse

    /**
     * `POST /api/homes/:id/household-access-requests/:requestId/approve`
     * — route `backend/routes/home.js:2714`. Mints a personal
     * `HomeInvite` and notifies the requester; it does not add them
     * directly, hence the "Invitation sent" response.
     */
    @POST("api/homes/{id}/household-access-requests/{requestId}/approve")
    suspend fun approveHouseholdAccessRequest(
        @Path("id") homeId: String,
        @Path("requestId") requestId: String,
    ): HouseholdAccessRequestActionResponse

    /**
     * `POST /api/homes/:id/household-access-requests/:requestId/reject`
     * — route `backend/routes/home.js:2831`.
     */
    @POST("api/homes/{id}/household-access-requests/{requestId}/reject")
    suspend fun rejectHouseholdAccessRequest(
        @Path("id") homeId: String,
        @Path("requestId") requestId: String,
    ): HouseholdAccessRequestActionResponse
}
