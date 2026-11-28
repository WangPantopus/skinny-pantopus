package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.moments.MomentEnvelope
import app.pantopus.android.data.api.models.plans.CreatePlanBody
import app.pantopus.android.data.api.models.reinvented.ReinventedAtlasResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleChangeBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleEnvelope
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleKeepBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleMakeBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCirclesResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedExploreResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedKeepBody
import app.pantopus.android.data.api.models.reinvented.ReinventedListResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedMagazineResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedMapResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedMomentPlanResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedStrandsResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedStrandsSeenBody
import app.pantopus.android.data.api.models.reinvented.ReinventedStripResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * "Pulse, reinvented" phase 1 (CONTRACT 6): the routes only the new Pulse tab reads, under `/api/reinvented/`, and only
 * while `pulse_reinvented` is on for the person. Today's screens never send them. Sent while the switch is off for the
 * caller, each answers `403 PULSE_REINVENTED_OFF`; a server from before them answers 404. A point, where one is sent, is
 * the phone's own place, rounded to five places, as the web and iPhone send it.
 */
@Suppress("TooManyFunctions") // The new Pulse's routes, one router on the server (`backend/routes/reinvented.js`).
interface ReinventedApi {
    /**
     * `GET /api/reinvented/list` (CONTRACT 6a): the Moments that fade and the posts that stay a reader may see, by reach
     * (`close`, `around`), miles, chip and cursor, with the distance bands. Route `backend/routes/reinvented.js` (list).
     */
    @Suppress("LongParameterList") // The route's own query, one parameter each.
    @GET("api/reinvented/list")
    suspend fun list(
        @Query("reach") reach: String,
        @Query("miles") miles: Int?,
        // Null only while filters (CONTRACT 10a) are sent: the chip and the kinds never go together.
        @Query("chip") chip: String?,
        @Query("latitude") latitude: String?,
        @Query("longitude") longitude: String?,
        @Query("cursor") cursor: String?,
        @Query("limit") limit: Int = PAGE,
        // CONTRACT 8d: with reach=close, only this circle's people who are in.
        @Query("circle") circle: String? = null,
        // CONTRACT 10a, the filters: each left out while null, so a read with none is exactly as before.
        @Query("kinds") kinds: String? = null,
        @Query("when") whenTime: String? = null,
        @Query("from") from: String? = null,
        @Query("state") state: String? = null,
        @Query("since") since: String? = null,
        // CONTRACT 11a: the map's box (all four or none), with `around`: the list is what the map shows there.
        @Query("south") south: String? = null,
        @Query("west") west: String? = null,
        @Query("north") north: String? = null,
        @Query("east") east: String? = null,
        // CONTRACT 11b: "1" adds the posts and Moments without a place, as one band at the end.
        @Query("no_place") noPlace: String? = null,
    ): ReinventedListResponse

    /**
     * `GET /api/reinvented/map` (CONTRACT 6b): rings, marks, tickets and kept Moments for a box and a time (`live`,
     * `today`, `week`, `all`, `tonight`, `weekend`). Route `backend/routes/reinvented.js` (map).
     */
    @Suppress("LongParameterList") // The box's four sides, the time and the filters.
    @GET("api/reinvented/map")
    suspend fun map(
        @Query("south") south: String,
        @Query("west") west: String,
        @Query("north") north: String,
        @Query("east") east: String,
        @Query("time") time: String,
        // CONTRACT 10a, the filters (the map takes no `when`: its time row is its When); each left out while null.
        @Query("kinds") kinds: String? = null,
        @Query("from") from: String? = null,
        @Query("state") state: String? = null,
        @Query("since") since: String? = null,
    ): ReinventedMapResponse

    /** `GET /api/reinvented/strip` (CONTRACT 6c): Alive right now. Route `backend/routes/reinvented.js` (strip). */
    @GET("api/reinvented/strip")
    suspend fun strip(
        @Query("latitude") latitude: String?,
        @Query("longitude") longitude: String?,
    ): ReinventedStripResponse

    /**
     * `GET /api/reinvented/explore` (CONTRACT 6f): "Today, elsewhere", then newest with variety. The point is the
     * reader's own, to leave their town out. Route `backend/routes/reinvented.js` (explore).
     */
    @GET("api/reinvented/explore")
    suspend fun explore(
        @Query("latitude") latitude: String?,
        @Query("longitude") longitude: String?,
        @Query("cursor") cursor: String?,
    ): ReinventedExploreResponse

    /** `GET /api/reinvented/atlas` (CONTRACT 6e): My Atlas by date, newest first. Route `backend/routes/reinvented.js` (atlas). */
    @GET("api/reinvented/atlas")
    suspend fun atlas(
        @Query("cursor") cursor: String?,
        @Query("limit") limit: Int = ATLAS_PAGE,
    ): ReinventedAtlasResponse

    /** `GET /api/reinvented/atlas` for a box (CONTRACT 6e): every kept Moment in it, for the map. */
    @GET("api/reinvented/atlas")
    suspend fun atlasInBox(
        @Query("south") south: String,
        @Query("west") west: String,
        @Query("north") north: String,
        @Query("east") east: String,
    ): ReinventedAtlasResponse

    /** `DELETE /api/reinvented/atlas/:id` (CONTRACT 6e): Delete for good; 204. Route `backend/routes/reinvented.js` (atlas). */
    @DELETE("api/reinvented/atlas/{id}")
    suspend fun deleteForGood(
        @Path("id") id: String,
    )

    /**
     * `POST /api/reinvented/moments/:id/keep` (CONTRACT 6d): the author answers "Keep this?" once; answers the Moment.
     * Route `backend/routes/reinvented.js` (moments/:id/keep).
     */
    @POST("api/reinvented/moments/{id}/keep")
    suspend fun keep(
        @Path("id") id: String,
        @Body body: ReinventedKeepBody,
    ): MomentEnvelope

    /**
     * `POST /api/reinvented/moments/:id/plan` (CONTRACT 6g), "Want to come?": the author starts a plan in Plans from
     * their own live Moment, with exactly the body `POST /api/plans` takes and Plans' own rules, answers and errors. The
     * query says what this app can draw, as `PlansBizInterceptor` adds it under `/api/plans`. Never a business's plan.
     * Route `backend/routes/reinvented.js` (moments/:id/plan).
     */
    @POST("api/reinvented/moments/{id}/plan")
    suspend fun startPlan(
        @Path("id") id: String,
        @Body body: CreatePlanBody,
        @Query("more") more: String = "1",
        @Query("guests") guests: String = "1",
        @Query("extras") extras: String = "1",
    ): ReinventedMomentPlanResponse

    /** CONTRACT 8d: the circles the reader is in, and the ones they are invited to. [tz] is the reader's own zone. */
    @GET("api/reinvented/circles")
    suspend fun circles(
        @Query("tz") tz: String?,
    ): ReinventedCirclesResponse

    @POST("api/reinvented/circles")
    suspend fun makeCircle(
        @Body body: ReinventedCircleMakeBody,
    ): ReinventedCircleEnvelope

    /** An invitee's yes, with their own Keep choice. */
    @POST("api/reinvented/circles/{id}/join")
    suspend fun joinCircle(
        @Path("id") id: String,
        @Body body: ReinventedCircleKeepBody,
    ): ReinventedCircleEnvelope

    /** A member's own Keep choice for this circle. */
    @POST("api/reinvented/circles/{id}/me")
    suspend fun circleKeep(
        @Path("id") id: String,
        @Body body: ReinventedCircleKeepBody,
    ): ReinventedCircleEnvelope

    /** Leave a circle, or say no to an invite (nobody is told who said no). */
    @POST("api/reinvented/circles/{id}/leave")
    suspend fun leaveCircle(
        @Path("id") id: String,
    )

    /** The maker renames it, or invites or removes people. */
    @PATCH("api/reinvented/circles/{id}")
    suspend fun changeCircle(
        @Path("id") id: String,
        @Body body: ReinventedCircleChangeBody,
    ): ReinventedCircleEnvelope

    /** The maker ends it. */
    @DELETE("api/reinvented/circles/{id}")
    suspend fun endCircle(
        @Path("id") id: String,
    )

    /** The circle's week, laid out (a member who is in). [week] is any day of the week wanted. */
    @GET("api/reinvented/circles/{id}/magazine")
    suspend fun magazine(
        @Path("id") id: String,
        @Query("week") week: String?,
        @Query("tz") tz: String?,
    ): ReinventedMagazineResponse

    /** `GET /api/reinvented/strands` (CONTRACT 8c): "Went because of you", told to the reader only. */
    @GET("api/reinvented/strands")
    suspend fun strands(
        @Query("cursor") cursor: String?,
    ): ReinventedStrandsResponse

    /** `POST /api/reinvented/strands/seen` (CONTRACT 8c): the groups' items the reader has now seen. */
    @POST("api/reinvented/strands/seen")
    suspend fun strandsSeen(
        @Body body: ReinventedStrandsSeenBody,
    )

    companion object {
        /** Moments on a page of My Atlas. */
        const val ATLAS_PAGE = 30

        /** Items on a page of the list. */
        const val PAGE = 20
    }
}
