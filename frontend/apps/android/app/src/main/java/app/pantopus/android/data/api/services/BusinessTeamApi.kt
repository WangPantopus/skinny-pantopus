package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessChangeRoleRequest
import app.pantopus.android.data.api.models.businesses.BusinessMemberPermissionsResponse
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetsResponse
import app.pantopus.android.data.api.models.businesses.BusinessSeatInviteRequest
import app.pantopus.android.data.api.models.businesses.BusinessSeatInviteResponse
import app.pantopus.android.data.api.models.businesses.BusinessSeatsResponse
import app.pantopus.android.data.api.models.businesses.BusinessTeamMembersResponse
import app.pantopus.android.data.api.models.businesses.BusinessTogglePermissionRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Owner-side business team & roles endpoints, spanning
 * `backend/routes/businessIam.js` (members / roles / permissions) and
 * `backend/routes/businessSeats.js` (pending seat invites). Both are
 * mounted at `/api/businesses`.
 */
interface BusinessTeamApi {
    /** `GET /api/businesses/:id/me` — route `backend/routes/businessIam.js:42`. */
    @GET("api/businesses/{businessId}/me")
    suspend fun access(
        @Path("businessId") businessId: String,
    ): BusinessAccessDto

    /** `GET /api/businesses/:id/role-presets` — route `backend/routes/businessIam.js:80`. */
    @GET("api/businesses/{businessId}/role-presets")
    suspend fun rolePresets(
        @Path("businessId") businessId: String,
    ): BusinessRolePresetsResponse

    /** `GET /api/businesses/:id/members` — route `backend/routes/businessIam.js:104`. */
    @GET("api/businesses/{businessId}/members")
    suspend fun members(
        @Path("businessId") businessId: String,
    ): BusinessTeamMembersResponse

    /** `POST /api/businesses/:id/members/:userId/role` — route `backend/routes/businessIam.js:224`. */
    @POST("api/businesses/{businessId}/members/{userId}/role")
    suspend fun changeRole(
        @Path("businessId") businessId: String,
        @Path("userId") userId: String,
        @Body body: BusinessChangeRoleRequest,
    )

    /** `GET /api/businesses/:id/members/:userId/permissions` — route `backend/routes/businessIam.js:493`. */
    @GET("api/businesses/{businessId}/members/{userId}/permissions")
    suspend fun memberPermissions(
        @Path("businessId") businessId: String,
        @Path("userId") userId: String,
    ): BusinessMemberPermissionsResponse

    /** `POST /api/businesses/:id/members/:userId/permissions` — route `backend/routes/businessIam.js:410`. */
    @POST("api/businesses/{businessId}/members/{userId}/permissions")
    suspend fun togglePermission(
        @Path("businessId") businessId: String,
        @Path("userId") userId: String,
        @Body body: BusinessTogglePermissionRequest,
    )

    /** `DELETE /api/businesses/:id/members/:userId` — route `backend/routes/businessIam.js:525`. */
    @DELETE("api/businesses/{businessId}/members/{userId}")
    suspend fun removeMember(
        @Path("businessId") businessId: String,
        @Path("userId") userId: String,
    )

    /** `GET /api/businesses/:id/seats` — route `backend/routes/businessSeats.js:425`. */
    @GET("api/businesses/{businessId}/seats")
    suspend fun seats(
        @Path("businessId") businessId: String,
    ): BusinessSeatsResponse

    /** `POST /api/businesses/:id/seats/invite` — route `backend/routes/businessSeats.js:495`. */
    @POST("api/businesses/{businessId}/seats/invite")
    suspend fun inviteSeat(
        @Path("businessId") businessId: String,
        @Body body: BusinessSeatInviteRequest,
    ): BusinessSeatInviteResponse

    /** `DELETE /api/businesses/:id/seats/:seatId` — route `backend/routes/businessSeats.js:698`. */
    @DELETE("api/businesses/{businessId}/seats/{seatId}")
    suspend fun cancelSeat(
        @Path("businessId") businessId: String,
        @Path("seatId") seatId: String,
    )
}
