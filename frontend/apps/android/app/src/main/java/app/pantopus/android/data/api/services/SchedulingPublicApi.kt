package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.scheduling.AvailableSlotsResponse
import app.pantopus.android.data.api.models.scheduling.ManageBookingResponse
import app.pantopus.android.data.api.models.scheduling.OneOffBookingView
import app.pantopus.android.data.api.models.scheduling.PollDetailResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingCreatedResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingMutationResponse
import app.pantopus.android.data.api.models.scheduling.PublicBookingPageResponse
import app.pantopus.android.data.api.models.scheduling.PublicCancelRequest
import app.pantopus.android.data.api.models.scheduling.PublicCreateBookingRequest
import app.pantopus.android.data.api.models.scheduling.PublicPollVoteRequest
import app.pantopus.android.data.api.models.scheduling.PublicRescheduleRequest
import app.pantopus.android.data.api.models.scheduling.PublicSlotsResponse
import app.pantopus.android.data.api.models.scheduling.PublicWaitlistJoinRequest
import app.pantopus.android.data.api.models.scheduling.PublicWaitlistJoinResponse
import app.pantopus.android.data.api.models.scheduling.SchedulingOkResponse
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

/**
 * The **public** Calendarly surface (`/api/public/…`) — invitee-facing reads
 * and writes that carry **no Authorization header**. Provided by a dedicated
 * unauthenticated client in `NetworkModule` (`@Named("publicScheduling")`), so
 * a stale/absent token is never attached to the signed-out invitee flow.
 *
 * `slug` = the booking PAGE slug (not a booking id). One-off links use the raw
 * `token`; manage links use the one-time manage `token`. Always pass `tz` on
 * slot reads; render `startLocal`, store UTC `start`.
 * See `reference/calendarly-backend-api.md` (schedulingPublic.js).
 */
@Suppress("TooManyFunctions")
interface SchedulingPublicApi {
    /** `GET /api/public/book/:slug` — page + status + event types. */
    @GET("api/public/book/{slug}")
    suspend fun getBookingPage(
        @Path("slug") slug: String,
    ): PublicBookingPageResponse

    /** `GET /api/public/book/:slug/:eventTypeSlug/slots`. */
    @GET("api/public/book/{slug}/{eventTypeSlug}/slots")
    suspend fun getSlots(
        @Path("slug") slug: String,
        @Path("eventTypeSlug") eventTypeSlug: String,
        @Query("from") from: String,
        @Query("to") to: String,
        @Query("tz") tz: String? = null,
    ): PublicSlotsResponse

    /** `POST /api/public/book/:slug/:eventTypeSlug` — returns manageToken (persist it). */
    @POST("api/public/book/{slug}/{eventTypeSlug}")
    suspend fun createBooking(
        @Path("slug") slug: String,
        @Path("eventTypeSlug") eventTypeSlug: String,
        @Body body: PublicCreateBookingRequest,
    ): PublicBookingCreatedResponse

    /** `POST /api/public/book/:slug/:eventTypeSlug/waitlist`. */
    @POST("api/public/book/{slug}/{eventTypeSlug}/waitlist")
    suspend fun joinWaitlist(
        @Path("slug") slug: String,
        @Path("eventTypeSlug") eventTypeSlug: String,
        @Body body: PublicWaitlistJoinRequest,
    ): PublicWaitlistJoinResponse

    /** `GET /api/public/book/o/:token` — one-off link landing (404 → status:'expired'). */
    @GET("api/public/book/o/{token}")
    suspend fun getOneOff(
        @Path("token") token: String,
        @Query("tz") tz: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
    ): OneOffBookingView

    /** `POST /api/public/book/o/:token` — one-off booking create. */
    @POST("api/public/book/o/{token}")
    suspend fun createOneOffBooking(
        @Path("token") token: String,
        @Body body: PublicCreateBookingRequest,
    ): PublicBookingCreatedResponse

    /** `GET /api/public/booking/:token` — manage view + actions + payment. */
    @GET("api/public/booking/{token}")
    suspend fun getManageBooking(
        @Path("token") token: String,
    ): ManageBookingResponse

    /** `GET /api/public/booking/:token/available-slots`. */
    @GET("api/public/booking/{token}/available-slots")
    suspend fun getManageAvailableSlots(
        @Path("token") token: String,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null,
        @Query("tz") tz: String? = null,
    ): AvailableSlotsResponse

    /** `GET /api/public/booking/:token/ics` — raw RFC 5545 calendar invite. */
    @Streaming
    @GET("api/public/booking/{token}/ics")
    suspend fun getIcs(
        @Path("token") token: String,
    ): ResponseBody

    /** `POST /api/public/booking/:token/reschedule`. */
    @POST("api/public/booking/{token}/reschedule")
    suspend fun reschedule(
        @Path("token") token: String,
        @Body body: PublicRescheduleRequest,
    ): PublicBookingMutationResponse

    /** `POST /api/public/booking/:token/cancel`. */
    @POST("api/public/booking/{token}/cancel")
    suspend fun cancel(
        @Path("token") token: String,
        @Body body: PublicCancelRequest,
    ): PublicBookingMutationResponse

    /** `POST /api/public/booking/:token/unsubscribe` — reminder emails only. */
    @POST("api/public/booking/{token}/unsubscribe")
    suspend fun unsubscribe(
        @Path("token") token: String,
    ): SchedulingOkResponse

    /** `POST /api/public/booking/:token/accept-reschedule`. */
    @POST("api/public/booking/{token}/accept-reschedule")
    suspend fun acceptReschedule(
        @Path("token") token: String,
    ): PublicBookingMutationResponse

    /** `POST /api/public/booking/:token/decline-reschedule`. */
    @POST("api/public/booking/{token}/decline-reschedule")
    suspend fun declineReschedule(
        @Path("token") token: String,
    ): PublicBookingMutationResponse

    /** `GET /api/public/poll/:id`. */
    @GET("api/public/poll/{id}")
    suspend fun getPoll(
        @Path("id") pollId: String,
    ): PollDetailResponse

    /** `POST /api/public/poll/:id/vote` — 409 POLL_CLOSED / 400 VOTER_REQUIRED. */
    @POST("api/public/poll/{id}/vote")
    suspend fun votePoll(
        @Path("id") pollId: String,
        @Body body: PublicPollVoteRequest,
    ): SchedulingOkResponse
}
