package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.token_accept.BusinessSeatAcceptBody
import app.pantopus.android.data.api.models.token_accept.BusinessSeatAcceptResponse
import app.pantopus.android.data.api.models.token_accept.BusinessSeatDeclineBody
import app.pantopus.android.data.api.models.token_accept.BusinessSeatInviteResponse
import app.pantopus.android.data.api.models.token_accept.GenericAcknowledgement
import app.pantopus.android.data.api.models.token_accept.GuestPassResponse
import app.pantopus.android.data.api.models.token_accept.HomeAcceptResponse
import app.pantopus.android.data.api.models.token_accept.HomeInviteResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Backs the T3.5 Token / Accept screen. Three resolver GETs run in
 * parallel; whichever 200s decides the invite type.
 */
interface TokenAcceptApi {
    /** `GET /api/homes/invitations/token/:token`. Route
     *  `backend/routes/home.js:1793`. */
    @GET("api/homes/invitations/token/{token}")
    suspend fun homeInvite(
        @Path("token") token: String,
    ): HomeInviteResponse

    /** `GET /api/businesses/seats/invite-details?token=X`. Route
     *  `backend/routes/businessSeats.js:138`. */
    @GET("api/businesses/seats/invite-details")
    suspend fun businessSeatInvite(
        @Query("token") token: String,
    ): BusinessSeatInviteResponse

    /** `GET /api/homes/guest/:token`. Route
     *  `backend/routes/homeGuest.js:20`. */
    @GET("api/homes/guest/{token}")
    suspend fun guestPass(
        @Path("token") token: String,
    ): GuestPassResponse

    /** `POST /api/homes/invitations/token/:token/accept`. Route
     *  `backend/routes/home.js:2040`. */
    @POST("api/homes/invitations/token/{token}/accept")
    suspend fun acceptHomeInvite(
        @Path("token") token: String,
    ): HomeAcceptResponse

    /** `POST /api/homes/invitations/:invitationId/reject`. Route
     *  `backend/routes/home.js:2013`. */
    @POST("api/homes/invitations/{invitationId}/reject")
    suspend fun declineHomeInvite(
        @Path("invitationId") invitationId: String,
    ): GenericAcknowledgement

    /** `POST /api/businesses/seats/accept-invite`. Route
     *  `backend/routes/businessSeats.js:207`. */
    @POST("api/businesses/seats/accept-invite")
    suspend fun acceptBusinessSeat(
        @Body body: BusinessSeatAcceptBody,
    ): BusinessSeatAcceptResponse

    /** `POST /api/businesses/seats/decline-invite`. Route
     *  `backend/routes/businessSeats.js:358`. */
    @POST("api/businesses/seats/decline-invite")
    suspend fun declineBusinessSeat(
        @Body body: BusinessSeatDeclineBody,
    ): GenericAcknowledgement
}
