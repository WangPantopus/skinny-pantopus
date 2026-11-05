@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.crewday.CrewDayBookingBody
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.api.models.crewday.CrewDayBookingPatch
import app.pantopus.android.data.api.models.crewday.CrewDayBookingResponse
import app.pantopus.android.data.api.models.crewday.CrewDayBusinessResponse
import app.pantopus.android.data.api.models.crewday.CrewDayCreateBody
import app.pantopus.android.data.api.models.crewday.CrewDayCrewViewDto
import app.pantopus.android.data.api.models.crewday.CrewDayDoneBody
import app.pantopus.android.data.api.models.crewday.CrewDayEditBody
import app.pantopus.android.data.api.models.crewday.CrewDayHomeResponse
import app.pantopus.android.data.api.models.crewday.CrewDayInvitePastResponse
import app.pantopus.android.data.api.models.crewday.CrewDayNewDateBody
import app.pantopus.android.data.api.models.crewday.CrewDayNoteBody
import app.pantopus.android.data.api.models.crewday.CrewDayOnTheWayBody
import app.pantopus.android.data.api.models.crewday.CrewDayPriceAnswerBody
import app.pantopus.android.data.api.models.crewday.CrewDayPriceBody
import app.pantopus.android.data.api.models.crewday.CrewDayProblemBody
import app.pantopus.android.data.api.models.crewday.CrewDayProposeDatesBody
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.api.models.crewday.CrewDayQuoteBody
import app.pantopus.android.data.api.models.crewday.CrewDayQuoteDto
import app.pantopus.android.data.api.models.crewday.CrewDayReasonBody
import app.pantopus.android.data.api.models.crewday.CrewDayRequestBody
import app.pantopus.android.data.api.models.crewday.CrewDayRequestResponse
import app.pantopus.android.data.api.models.crewday.CrewDayResponse
import app.pantopus.android.data.api.models.crewday.CrewDayRouteDto
import app.pantopus.android.data.api.models.crewday.CrewDayRouteOrderBody
import app.pantopus.android.data.api.models.crewday.CrewDayRunningLateBody
import app.pantopus.android.data.api.models.crewday.CrewDayRunningLateResponse
import app.pantopus.android.data.api.models.crewday.CrewDayTodayResponse
import app.pantopus.android.data.api.models.crewday.CrewDayUploadResponse
import app.pantopus.android.data.api.models.crewday.MyCrewDaysResponse
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Crew Day: every `/api/crew-days` route the apps use (docs/product/crew-day-build/02-contract.md, section 4; the
 * operator's `/api/admin/crew-days` routes are web only). While the `crew_day` key is off on the server every route
 * answers 403 `CREW_DAY_UNAVAILABLE`; the app shows no Crew Day entry point then, so a screen only meets that answer
 * when the server and the app disagree. Routes: `backend/routes/crewDays.js`.
 */
interface CrewDaysApi {
    // MARK: - Public (no account needed)

    /** `GET /api/crew-days/public/:code`: the invitation (screen 1). 404 for an unknown code or a day not approved. */
    @GET("api/crew-days/public/{code}")
    suspend fun invitation(
        @Path("code") code: String,
    ): CrewDayPublicDto

    /** `POST /api/crew-days/public/:code/quote`: one home's price, or that the day doesn't reach it (screen 2). */
    @POST("api/crew-days/public/{code}/quote")
    suspend fun quote(
        @Path("code") code: String,
        @Body body: CrewDayQuoteBody,
    ): CrewDayQuoteDto

    // MARK: - Household

    /** `POST /api/crew-days/:id/bookings` (screen 3): `booked`, or `price_pending` for a look-first option. */
    @POST("api/crew-days/{id}/bookings")
    suspend fun book(
        @Path("id") crewDayId: String,
        @Body body: CrewDayBookingBody,
    ): CrewDayBookingResponse

    /** `GET /api/crew-days/mine` (screen 10). */
    @GET("api/crew-days/mine")
    suspend fun mine(): MyCrewDaysResponse

    /** `GET /api/crew-days/today` (screen 9). */
    @GET("api/crew-days/today")
    suspend fun today(): CrewDayTodayResponse

    /** `POST /api/crew-days/:id/dismiss`: "Not for me" on Today's "Coming to your street". */
    @POST("api/crew-days/{id}/dismiss")
    suspend fun dismiss(
        @Path("id") crewDayId: String,
    )

    /** `GET /api/crew-days/bookings/:bookingId` (screen 5). */
    @GET("api/crew-days/bookings/{bookingId}")
    suspend fun booking(
        @Path("bookingId") bookingId: String,
    ): CrewDayBookingDto

    /** `PATCH /api/crew-days/bookings/:bookingId`: the access note, or (before the cutoff) the home's details. */
    @PATCH("api/crew-days/bookings/{bookingId}")
    suspend fun updateBooking(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayBookingPatch,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/cancel`: free before the cutoff; 409 `ASK_THE_CREW` after it. */
    @POST("api/crew-days/bookings/{bookingId}/cancel")
    suspend fun cancelBooking(
        @Path("bookingId") bookingId: String,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/ask-release`: after the cutoff, asks the crew to release the home. */
    @POST("api/crew-days/bookings/{bookingId}/ask-release")
    suspend fun askRelease(
        @Path("bookingId") bookingId: String,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/price-answer`: approve or decline the crew's price. */
    @POST("api/crew-days/bookings/{bookingId}/price-answer")
    suspend fun answerPrice(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayPriceAnswerBody,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/gate-ready`: tells the crew. */
    @POST("api/crew-days/bookings/{bookingId}/gate-ready")
    suspend fun gateReady(
        @Path("bookingId") bookingId: String,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/confirm`: "Everything looks good" charges now. */
    @POST("api/crew-days/bookings/{bookingId}/confirm")
    suspend fun confirm(
        @Path("bookingId") bookingId: String,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/problem`: opens the case, or adds a note or photos to it. */
    @POST("api/crew-days/bookings/{bookingId}/problem")
    suspend fun reportProblem(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayProblemBody,
    ): CrewDayBookingResponse

    /** `POST /api/crew-days/bookings/:bookingId/new-date`: a proposed date, or `cancel`. */
    @POST("api/crew-days/bookings/{bookingId}/new-date")
    suspend fun answerNewDate(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayNewDateBody,
    ): CrewDayBookingResponse

    /**
     * `POST /api/crew-days/uploads`: one JPEG, PNG or HEIC image (up to 10 MB) as `photo`, for a booking, with its
     * `purpose`: `done` (the crew) or `problem` (the household).
     */
    @Multipart
    @POST("api/crew-days/uploads")
    suspend fun upload(
        @Part("booking_id") bookingId: okhttp3.RequestBody,
        @Part("purpose") purpose: okhttp3.RequestBody,
        @Part photo: MultipartBody.Part,
    ): CrewDayUploadResponse

    /** `POST /api/crew-days/requests` (screen 11): "Ask for a Crew Day on my street". */
    @POST("api/crew-days/requests")
    suspend fun askForCrewDay(
        @Body body: CrewDayRequestBody,
    ): CrewDayRequestResponse

    // MARK: - Crew

    /** `GET /api/crew-days/business/:businessId` (screen 13): readiness and the business's street days. */
    @GET("api/crew-days/business/{businessId}")
    suspend fun business(
        @Path("businessId") businessId: String,
    ): CrewDayBusinessResponse

    /** `POST /api/crew-days` (screen 14): a draft, or sent for approval. 422 `BUSINESS_NOT_READY` with `missing`. */
    @POST("api/crew-days")
    suspend fun create(
        @Body body: CrewDayCreateBody,
    ): CrewDayResponse

    /** `PATCH /api/crew-days/:id`: capacity, included items, the prep note and future prices. */
    @PATCH("api/crew-days/{id}")
    suspend fun edit(
        @Path("id") crewDayId: String,
        @Body body: CrewDayEditBody,
    ): CrewDayResponse

    /** `POST /api/crew-days/:id/submit`: a draft goes to Pantopus for approval. */
    @POST("api/crew-days/{id}/submit")
    suspend fun submit(
        @Path("id") crewDayId: String,
    ): CrewDayResponse

    /** `GET /api/crew-days/:id/crew` (screens 15 and 19). */
    @GET("api/crew-days/{id}/crew")
    suspend fun crewDay(
        @Path("id") crewDayId: String,
    ): CrewDayCrewViewDto

    /** `POST /api/crew-days/:id/bookings/:bookingId/price`: sets a look-first home's price, or declines it. */
    @POST("api/crew-days/{id}/bookings/{bookingId}/price")
    suspend fun setPrice(
        @Path("id") crewDayId: String,
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayPriceBody,
    ): CrewDayHomeResponse

    /** `POST /api/crew-days/:id/bookings/:bookingId/release`: a home inside the cutoff, at no charge. */
    @POST("api/crew-days/{id}/bookings/{bookingId}/release")
    suspend fun release(
        @Path("id") crewDayId: String,
        @Path("bookingId") bookingId: String,
    ): CrewDayHomeResponse

    /** `POST /api/crew-days/:id/invite-past`: invites the homes this business served nearby, once each. */
    @POST("api/crew-days/{id}/invite-past")
    suspend fun invitePast(
        @Path("id") crewDayId: String,
    ): CrewDayInvitePastResponse

    /** `POST /api/crew-days/:id/propose-dates` (screen 18): two or three new dates for every booked home. */
    @POST("api/crew-days/{id}/propose-dates")
    suspend fun proposeDates(
        @Path("id") crewDayId: String,
        @Body body: CrewDayProposeDatesBody,
    ): CrewDayResponse

    /** `POST /api/crew-days/:id/cancel`: the day and every active booking, nobody charged. */
    @POST("api/crew-days/{id}/cancel")
    suspend fun cancelDay(
        @Path("id") crewDayId: String,
        @Body body: CrewDayReasonBody,
    ): CrewDayResponse

    /** `GET /api/crew-days/:id/route?date=` (screen 16). */
    @GET("api/crew-days/{id}/route")
    suspend fun route(
        @Path("id") crewDayId: String,
        @Query("date") date: String?,
    ): CrewDayRouteDto

    /** `POST /api/crew-days/:id/route/order`: the crew's order for the homes. */
    @POST("api/crew-days/{id}/route/order")
    suspend fun reorder(
        @Path("id") crewDayId: String,
        @Body body: CrewDayRouteOrderBody,
    ): CrewDayRouteDto

    /** `POST /api/crew-days/bookings/:bookingId/on-the-way`: the one-hour window the household is told. */
    @POST("api/crew-days/bookings/{bookingId}/on-the-way")
    suspend fun onTheWay(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayOnTheWayBody,
    ): CrewDayHomeResponse

    /** `POST /api/crew-days/:id/running-late`: pushes every remaining home's window back and tells them. */
    @POST("api/crew-days/{id}/running-late")
    suspend fun runningLate(
        @Path("id") crewDayId: String,
        @Body body: CrewDayRunningLateBody,
    ): CrewDayRunningLateResponse

    /** `POST /api/crew-days/bookings/:bookingId/cant-get-in`: records it and tells the household. */
    @POST("api/crew-days/bookings/{bookingId}/cant-get-in")
    suspend fun cantGetIn(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayNoteBody,
    ): CrewDayHomeResponse

    /** `POST /api/crew-days/bookings/:bookingId/done` (screen 17): at least one photo; makes the invoice. */
    @POST("api/crew-days/bookings/{bookingId}/done")
    suspend fun markDone(
        @Path("bookingId") bookingId: String,
        @Body body: CrewDayDoneBody,
    ): CrewDayHomeResponse
}
