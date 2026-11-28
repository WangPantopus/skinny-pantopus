package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.moments.MomentDailySpotResponse
import app.pantopus.android.data.api.models.moments.MomentEditBody
import app.pantopus.android.data.api.models.moments.MomentEnvelope
import app.pantopus.android.data.api.models.moments.MomentGuessBody
import app.pantopus.android.data.api.models.moments.MomentGuessResponse
import app.pantopus.android.data.api.models.moments.MomentPlayAnswerBody
import app.pantopus.android.data.api.models.moments.MomentPlayAnswerResponse
import app.pantopus.android.data.api.models.moments.MomentPlayAnswersPageDto
import app.pantopus.android.data.api.models.moments.MomentSignalResponse
import app.pantopus.android.data.api.models.moments.MomentStampsPreviewBody
import app.pantopus.android.data.api.models.moments.MomentStampsPreviewResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * The requests only "Pulse, reinvented"'s new screens send (CONTRACT sections 2 to 4), and only while
 * `pulse_reinvented` is on for the person. Today's screens never send them. Sent while the switch is off for the
 * caller, each answers `403 PULSE_REINVENTED_OFF` (CONTRACT 1).
 */
interface StudioApi {
    /**
     * `POST /api/moments/place-preview` with `stamps: true` (CONTRACT 2a): what the tray's stamps would read for a Moment
     * posted here now. Route `backend/routes/moments.js` (place-preview, `stampsPreview`).
     */
    @POST("api/moments/place-preview")
    suspend fun stampsPreview(
        @Body body: MomentStampsPreviewBody,
    ): MomentStampsPreviewResponse

    /**
     * `PUT /api/moments/:id/reaction` with `{ "signal": "learned" }` or `{ "signal": null }` (CONTRACT 4): one of the
     * five signals, or none; it replaces the caller's emoji. The body is raw JSON, so taking a signal back sends the null.
     * Route `backend/routes/moments.js` (reaction).
     */
    @PUT("api/moments/{id}/reaction")
    suspend fun signal(
        @Path("id") id: String,
        @Body body: RequestBody,
    ): MomentSignalResponse

    /**
     * `PATCH /api/moments/:id` (CONTRACT 3): the author changes the caption, the stamps or who sees it, for 15 minutes
     * after it went out. Route `backend/routes/moments.js` (PATCH /:id).
     */
    @PATCH("api/moments/{id}")
    suspend fun edit(
        @Path("id") id: String,
        @Body body: MomentEditBody,
    ): MomentEnvelope

    /**
     * `POST /api/moments/:id/guess` (CONTRACT 5c): the reader's one guess at a guess-the-spot Moment; a second one
     * answers the first again. Route `backend/routes/moments.js` (guess).
     */
    @POST("api/moments/{id}/guess")
    suspend fun guess(
        @Path("id") id: String,
        @Body body: MomentGuessBody,
    ): MomentGuessResponse

    /**
     * `GET /api/moments/daily-spot` (CONTRACT 5d): today's guess-the-spot Moment for the town at this point, or null.
     * Route `backend/routes/moments.js` (daily-spot).
     */
    @GET("api/moments/daily-spot")
    suspend fun dailySpot(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
    ): MomentDailySpotResponse

    /**
     * `DELETE /api/reinvented/dots/:id/:dot` (CONTRACT 7c): the author takes one dot off their Moment; 204. Route
     * `backend/routes/reinvented.js` (dots).
     */
    @DELETE("api/reinvented/dots/{id}/{dot}")
    suspend fun removeDot(
        @Path("id") id: String,
        @Path("dot") dot: String,
    )

    /**
     * `PUT /api/reinvented/play/:id/:item` (CONTRACT 7b): a reader's answer to one playable item; the item comes back with
     * what they may now see. Route `backend/routes/reinvented.js` (play).
     */
    @PUT("api/reinvented/play/{id}/{item}")
    suspend fun answerPlay(
        @Path("id") id: String,
        @Path("item") item: String,
        @Body body: MomentPlayAnswerBody,
    ): MomentPlayAnswerResponse

    /** `DELETE /api/reinvented/play/:id/:item` (CONTRACT 7b): the reader takes their answer back; 204. */
    @DELETE("api/reinvented/play/{id}/{item}")
    suspend fun takeBackPlay(
        @Path("id") id: String,
        @Path("item") item: String,
    )

    /** `GET /api/reinvented/play/:id/:item/answers` (CONTRACT 7b): a question box's answers, to its author only. */
    @GET("api/reinvented/play/{id}/{item}/answers")
    suspend fun playAnswers(
        @Path("id") id: String,
        @Path("item") item: String,
        @Query("cursor") cursor: String? = null,
    ): MomentPlayAnswersPageDto

    /** `DELETE /api/reinvented/play/:id/:item/answers/:answer`: the author removes one answer; 204. */
    @DELETE("api/reinvented/play/{id}/{item}/answers/{answer}")
    suspend fun removePlayAnswer(
        @Path("id") id: String,
        @Path("item") item: String,
        @Path("answer") answer: String,
    )

    /**
     * `POST /api/reinvented/moments/:id/motion` (CONTRACT 10b): a motion photo's clip (`video/mp4`, at most 4 s and 15 MB)
     * beside the author's own photo Moment, once its photo is up, with one or two frames for the picture check. Route
     * `backend/routes/reinvented.js` (motion).
     */
    @Multipart
    @POST("api/reinvented/moments/{id}/motion")
    suspend fun uploadMotion(
        @Path("id") id: String,
        @Part file: MultipartBody.Part,
        @Part frames: List<MultipartBody.Part>,
    ): MomentEnvelope
}
