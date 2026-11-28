package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.moments.MomentEnvelope
import app.pantopus.android.data.api.models.reinvented.ConvergenceEnvelope
import app.pantopus.android.data.api.models.reinvented.CrowdEnvelope
import app.pantopus.android.data.api.models.reinvented.EyesOnNearBody
import app.pantopus.android.data.api.models.reinvented.EyesOnNearResponse
import app.pantopus.android.data.api.models.reinvented.MomentPinEnvelope
import app.pantopus.android.data.api.models.reinvented.MomentPinReactionBody
import app.pantopus.android.data.api.models.reinvented.MomentPinsResponse
import app.pantopus.android.data.api.models.reinvented.MomentRepliesResponse
import app.pantopus.android.data.api.models.reinvented.MomentRepliesShownBody
import app.pantopus.android.data.api.models.reinvented.MomentReplyBody
import app.pantopus.android.data.api.models.reinvented.MomentReplyEnvelope
import app.pantopus.android.data.api.models.reinvented.MomentReplyReportBody
import app.pantopus.android.data.api.models.reinvented.PinboardEnvelope
import app.pantopus.android.data.api.models.reinvented.RelicsNearResponse
import app.pantopus.android.data.api.models.reinvented.RetakeEnvelope
import app.pantopus.android.data.api.models.reinvented.SealPlaceBody
import app.pantopus.android.data.api.models.reinvented.SkyStripResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * "Pulse, reinvented" phase 3, together (CONTRACT 8): replies people can see on a Moment (8a). Only while the switch is on
 * for the caller (`403 PULSE_REINVENTED_OFF` otherwise). Routes in `backend/routes/reinvented.js` (moments/:id/replies).
 */
@Suppress("TooManyFunctions") // One route each, phase 3 piece by piece (CONTRACT 8), as ReinventedApi.
interface TogetherApi {
    @GET("api/reinvented/moments/{id}/replies")
    suspend fun replies(
        @Path("id") id: String,
        @Query("cursor") cursor: String?,
    ): MomentRepliesResponse

    @POST("api/reinvented/moments/{id}/replies")
    suspend fun reply(
        @Path("id") id: String,
        @Body body: MomentReplyBody,
    ): MomentReplyEnvelope

    @DELETE("api/reinvented/moments/{id}/replies/{reply}")
    suspend fun remove(
        @Path("id") id: String,
        @Path("reply") reply: String,
    )

    @POST("api/reinvented/moments/{id}/replies/{reply}/report")
    suspend fun report(
        @Path("id") id: String,
        @Path("reply") reply: String,
        @Body body: MomentReplyReportBody,
    )

    /** The author shows or hides the replies on their own Moment (the replies stay stored). */
    @POST("api/reinvented/moments/{id}/replies-shown")
    suspend fun setShown(
        @Path("id") id: String,
        @Body body: MomentRepliesShownBody,
    ): MomentEnvelope

    /** CONTRACT 8b: the pins this reader may see on the picture. */
    @GET("api/reinvented/moments/{id}/pins")
    suspend fun pins(
        @Path("id") id: String,
    ): MomentPinsResponse

    /** CONTRACT 8b: a reaction pin (JSON). Remove and report are the replies' own (a pin's id is its reply's). */
    @POST("api/reinvented/moments/{id}/pins")
    suspend fun dropReaction(
        @Path("id") id: String,
        @Body body: MomentPinReactionBody,
    ): MomentPinEnvelope

    /** CONTRACT 8e: a Retake, by its start's id or any frame's (`404 RETAKE_NOT_FOUND` where the reader may not see it). */
    @GET("api/reinvented/retakes/{id}")
    suspend fun retake(
        @Path("id") id: String,
    ): RetakeEnvelope

    /** CONTRACT 8f: open Eyes-on Asks near the reader, whose place goes in the body only (never kept or logged). */
    @POST("api/reinvented/eyes-on/near")
    suspend fun eyesOnNear(
        @Body body: EyesOnNearBody,
    ): EyesOnNearResponse

    /** CONTRACT 8h: a convergence (its id goes in the path as it is, for example `sunset:45.6:-122.4:2026-11-27`). */
    @GET("api/reinvented/convergences/{id}")
    suspend fun convergence(
        @Path("id") id: String,
    ): ConvergenceEnvelope

    /** CONTRACT 8h: the sunset bands of a convergence's place, one row per day. */
    @GET("api/reinvented/strip/sky")
    suspend fun skyStrip(
        @Query("cell") cell: String,
        @Query("days") days: Int,
    ): SkyStripResponse

    /** CONTRACT 8i: a pinboard, by its start's id or any piece's (`404 PINBOARD_NOT_FOUND` where the reader may not see it). */
    @GET("api/reinvented/pinboards/{id}")
    suspend fun pinboard(
        @Path("id") id: String,
    ): PinboardEnvelope

    /** CONTRACT 8i: the scene a photo or video Moment was taken in, from every phone (`{ "crowd": null }` under three). */
    @GET("api/reinvented/crowd/{id}")
    suspend fun crowd(
        @Path("id") id: String,
    ): CrowdEnvelope

    /** CONTRACT 8g: place relics within 300 m of the reader, whose place goes in the body only (never kept). */
    @POST("api/reinvented/seals/near")
    suspend fun sealsNear(
        @Body body: SealPlaceBody,
    ): RelicsNearResponse

    /** CONTRACT 8g: opens a place relic for a reader standing within 100 m (`422 SEAL_NOT_HERE` otherwise). */
    @POST("api/reinvented/seals/{id}/open")
    suspend fun openSeal(
        @Path("id") id: String,
        @Body body: SealPlaceBody,
    ): MomentEnvelope

    /**
     * `POST /api/moments` (`backend/routes/moments.js`, create) with phase 3's keys beside today's body (CONTRACT 8):
     * only from the Studio, only while the switch is on and the Studio chose one ([TogetherCreate]).
     */
    @POST("api/moments")
    suspend fun createMoment(
        @Body body: Map<String, @JvmSuppressWildcards Any?>,
    ): MomentEnvelope
}
