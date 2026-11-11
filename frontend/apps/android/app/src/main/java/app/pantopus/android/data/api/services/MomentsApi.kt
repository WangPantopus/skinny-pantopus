@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentAdultConfirmResponse
import app.pantopus.android.data.api.models.moments.MomentEnvelope
import app.pantopus.android.data.api.models.moments.MomentPlacePreviewDto
import app.pantopus.android.data.api.models.moments.MomentPointBody
import app.pantopus.android.data.api.models.moments.MomentReactionResponse
import app.pantopus.android.data.api.models.moments.MomentReplyBody
import app.pantopus.android.data.api.models.moments.MomentReplyResponse
import app.pantopus.android.data.api.models.moments.MomentReportBody
import app.pantopus.android.data.api.models.moments.MomentViewersResponse
import app.pantopus.android.data.api.models.moments.MomentsMapResponse
import app.pantopus.android.data.api.models.moments.MomentsMineResponse
import app.pantopus.android.data.api.models.moments.MomentsUnseenResponse
import app.pantopus.android.data.api.models.plans.FeatureFlagResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Pantopus Moments: the `/api/moments` routes of the Moments contract (v3.1, owned by the server session;
 * `backend/routes/moments.js`). Every route answers 404 `MOMENTS_UNAVAILABLE` while the `moments` flag is off for
 * the caller, so the app reads [flag] first, as Plans does.
 */
interface MomentsApi {
    /** `GET /api/feature-flags/moments` (`backend/routes/featureFlags.js:30`). */
    @GET("api/feature-flags/{flagName}")
    suspend fun flag(
        @Path("flagName") flagName: String,
    ): FeatureFlagResponse

    /** `GET /api/moments/map`: live, unexpired rings in view, newest first (at most 300). */
    @GET("api/moments/map")
    suspend fun map(
        @Query("south") south: Double,
        @Query("west") west: Double,
        @Query("north") north: Double,
        @Query("east") east: Double,
        @Query("zoom") zoom: Int,
    ): MomentsMapResponse

    /**
     * `GET /api/moments/unseen` (contract v3): how many people have a live Moment in the box that the caller may see,
     * hasn't watched and that went live after [since] (none: everything live counts). For the Moments tab's dot. Any
     * Moments call also tells the server this app has Moments, so a connection's new Moment may push here.
     */
    @GET("api/moments/unseen")
    suspend fun unseen(
        @Query("south") south: Double,
        @Query("west") west: Double,
        @Query("north") north: Double,
        @Query("east") east: Double,
        @Query("since") since: String? = null,
        /** This app shows Moments with no location (in the strip), so they count toward the dot (contract v3.4). */
        @Query("include_unplaced") includeUnplaced: Boolean = true,
    ): MomentsUnseenResponse

    /** `GET /api/moments/mine`: the caller's own unexpired Moments, any state but ended. */
    @GET("api/moments/mine")
    suspend fun mine(): MomentsMineResponse

    /** `GET /api/moments/:id`: 410 `MOMENT_ENDED` once it has ended, 404 when it isn't visible. */
    @GET("api/moments/{id}")
    suspend fun moment(
        @Path("id") id: String,
    ): MomentEnvelope

    /** `POST /api/moments/:id/view`: one view per person; the author's own don't count. */
    @POST("api/moments/{id}/view")
    suspend fun view(
        @Path("id") id: String,
    ): Response<Unit>

    /** `GET /api/moments/:id/viewers` (author only), newest first. */
    @GET("api/moments/{id}/viewers")
    suspend fun viewers(
        @Path("id") id: String,
    ): MomentViewersResponse

    /**
     * `PUT /api/moments/:id/reaction` with `{emoji}` or `{emoji: null}`. The body is raw JSON: the app's Moshi
     * leaves out nulls, and taking a reaction back has to send the null.
     */
    @PUT("api/moments/{id}/reaction")
    suspend fun react(
        @Path("id") id: String,
        @Body body: RequestBody,
    ): MomentReactionResponse

    /** `POST /api/moments/:id/reply`: a direct chat message to the author, with the Moment above it. */
    @POST("api/moments/{id}/reply")
    suspend fun reply(
        @Path("id") id: String,
        @Body body: MomentReplyBody,
    ): MomentReplyResponse

    /** `DELETE /api/moments/:id` (author only). */
    @DELETE("api/moments/{id}")
    suspend fun delete(
        @Path("id") id: String,
    ): Response<Unit>

    /** `POST /api/moments/:id/report`: two reports from different people hold it until reviewed. */
    @POST("api/moments/{id}/report")
    suspend fun report(
        @Path("id") id: String,
        @Body body: MomentReportBody,
    ): Response<Unit>

    /** `PUT /api/moments/authors/:userId/mute`: hides that person's Moments (Settings' mute list undoes it). */
    @PUT("api/moments/authors/{userId}/mute")
    suspend fun mute(
        @Path("userId") userId: String,
    ): Response<Unit>

    /** `DELETE /api/moments/authors/:userId/mute`: the Undo after muting. */
    @DELETE("api/moments/authors/{userId}/mute")
    suspend fun unmute(
        @Path("userId") userId: String,
    ): Response<Unit>

    /** `POST /api/moments/place-preview`: the place a spot pins at, whether it's the caller's home, and the 18+ state. */
    @POST("api/moments/place-preview")
    suspend fun placePreview(
        @Body body: MomentPointBody,
    ): MomentPlacePreviewDto

    /** `POST /api/moments/adult-confirm`: the one-time 18+ confirmation (shared with Pulse's). */
    @POST("api/moments/adult-confirm")
    suspend fun adultConfirm(): MomentAdultConfirmResponse

    /** `POST /api/moments`: 201 with the Moment; a photo or video starts `uploading`, a text card is `live` at once. */
    @POST("api/moments")
    suspend fun create(
        @Body body: CreateMomentBody,
    ): MomentEnvelope

    /**
     * `POST /api/moments/:id/media`: the photo, or the video with its poster (required) and up to two more frames for
     * the picture check. Sending the same file again is a no-op.
     */
    @Multipart
    @POST("api/moments/{id}/media")
    suspend fun uploadMedia(
        @Path("id") id: String,
        @Part file: MultipartBody.Part,
        @Part poster: MultipartBody.Part? = null,
        @Part frames: List<MultipartBody.Part> = emptyList(),
    ): MomentEnvelope
}
