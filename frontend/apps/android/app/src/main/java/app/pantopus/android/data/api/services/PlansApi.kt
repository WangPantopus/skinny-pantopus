@file:Suppress("LongParameterList", "TooManyFunctions")

package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.plans.AcceptRequestBody
import app.pantopus.android.data.api.models.plans.AskToJoinBody
import app.pantopus.android.data.api.models.plans.AskToJoinResponse
import app.pantopus.android.data.api.models.plans.CancelPlanBody
import app.pantopus.android.data.api.models.plans.CreatePlanBody
import app.pantopus.android.data.api.models.plans.FeatureFlagResponse
import app.pantopus.android.data.api.models.plans.MyPlansResponse
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanFeedbackBody
import app.pantopus.android.data.api.models.plans.PlanGamesResponse
import app.pantopus.android.data.api.models.plans.PlanNearbyPlacesResponse
import app.pantopus.android.data.api.models.plans.PlanPinsResponse
import app.pantopus.android.data.api.models.plans.PlanReportBody
import app.pantopus.android.data.api.models.plans.PlanRequestsResponse
import app.pantopus.android.data.api.models.plans.PlansListResponse
import app.pantopus.android.data.api.models.plans.PublicPlanDto
import app.pantopus.android.data.api.models.plans.StillComingBody
import app.pantopus.android.data.api.models.plans.UpdatePlanBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Nearby Plans: every `/api/plans` route of the build brief (section 5), the Plans layer of
 * `GET /api/posts/map`, and the flag read. Every Plans route answers 404 while the `plans` flag is off for the
 * viewer, so the app checks [flag] first and treats a 404 as "not available", never as an error.
 * Routes: `backend/routes/plans.js` (P1).
 */
interface PlansApi {
    /** `GET /api/feature-flags/:flagName` (`backend/routes/featureFlags.js:30`): `plans` or `plans_playdates`. */
    @GET("api/feature-flags/{flagName}")
    suspend fun flag(
        @Path("flagName") flagName: String,
    ): FeatureFlagResponse

    /**
     * `GET /api/posts/map?layers=plans`: pins for one viewport. `window` is `now`, `today`, `week` or `weekend`.
     * `latitude`/`longitude` is where the person browses from: each pin's distance band is measured from it.
     */
    @GET("api/posts/map")
    suspend fun pins(
        @Query("south") south: Double,
        @Query("west") west: Double,
        @Query("north") north: Double,
        @Query("east") east: Double,
        @Query("kinds") kinds: String?,
        @Query("window") window: String,
        @Header("If-None-Match") etag: String?,
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null,
        @Query("gps_latitude") gpsLatitude: Double? = null,
        @Query("gps_longitude") gpsLongitude: Double? = null,
        @Query("gps_timestamp") gpsTimestamp: String? = null,
        @Query("layers") layers: String = "plans",
    ): Response<PlanPinsResponse>

    /**
     * `GET /api/plans`: the list under the map, soonest first. The `gps_*` fix (under 5 minutes old) counts as a
     * location for `can_ask`; homes and saved places always count.
     */
    @GET("api/plans")
    suspend fun list(
        @Query("latitude") latitude: Double?,
        @Query("longitude") longitude: Double?,
        @Query("window") window: String,
        @Query("kinds") kinds: String?,
        @Query("cursor") cursor: String?,
        @Header("If-None-Match") etag: String?,
        @Query("gps_latitude") gpsLatitude: Double? = null,
        @Query("gps_longitude") gpsLongitude: Double? = null,
        @Query("gps_timestamp") gpsTimestamp: String? = null,
    ): Response<PlansListResponse>

    /** `GET /api/plans/mine`: hosting, going, asked and waitlisted. */
    @GET("api/plans/mine")
    suspend fun mine(
        @Header("If-None-Match") etag: String?,
    ): Response<MyPlansResponse>

    /**
     * `GET /api/plans/:id`: the detail for the host and people in, the card for everyone else, 404 otherwise. A
     * playdate the viewer may not see yet answers 404 `{ error: "needs_verified_address", plan: { kind, city } }`
     * (J9), so this returns the raw response.
     */
    @GET("api/plans/{id}")
    suspend fun plan(
        @Path("id") id: String,
        @Query("latitude") latitude: Double? = null,
        @Query("longitude") longitude: Double? = null,
        @Query("gps_latitude") gpsLatitude: Double? = null,
        @Query("gps_longitude") gpsLongitude: Double? = null,
        @Query("gps_timestamp") gpsTimestamp: String? = null,
    ): Response<PlanDto>

    /** `POST /api/plans` (201 with the detail). */
    @POST("api/plans")
    suspend fun create(
        @Body body: CreatePlanBody,
    ): PlanDto

    /** `PATCH /api/plans/:id`: host edits; moving the time over 30 minutes or the place asks "Still coming?". */
    @PATCH("api/plans/{id}")
    suspend fun update(
        @Path("id") id: String,
        @Body body: UpdatePlanBody,
    ): PlanDto

    /** `POST /api/plans/:id/cancel`. */
    @POST("api/plans/{id}/cancel")
    suspend fun cancel(
        @Path("id") id: String,
        @Body body: CancelPlanBody,
    ): Unit

    /** `POST /api/plans/:id/requests`: ask to join (idempotent per person). */
    @POST("api/plans/{id}/requests")
    suspend fun ask(
        @Path("id") id: String,
        @Body body: AskToJoinBody,
    ): AskToJoinResponse

    /** `DELETE /api/plans/:id/requests/mine`: withdraw a request or leave the plan. */
    @DELETE("api/plans/{id}/requests/mine")
    suspend fun withdraw(
        @Path("id") id: String,
    ): Unit

    /** `GET /api/plans/:id/requests` (host only). */
    @GET("api/plans/{id}/requests")
    suspend fun requests(
        @Path("id") id: String,
    ): PlanRequestsResponse

    /** `POST /api/plans/:id/requests/:requestId/accept`: 409 `full` when no spot is left. */
    @POST("api/plans/{id}/requests/{requestId}/accept")
    suspend fun accept(
        @Path("id") id: String,
        @Path("requestId") requestId: String,
        @Body body: AcceptRequestBody,
    ): Unit

    /** `POST /api/plans/:id/requests/:requestId/decline`. */
    @POST("api/plans/{id}/requests/{requestId}/decline")
    suspend fun decline(
        @Path("id") id: String,
        @Path("requestId") requestId: String,
    ): Unit

    /** `POST /api/plans/:id/requests/:requestId/remove`: take an accepted guest out. */
    @POST("api/plans/{id}/requests/{requestId}/remove")
    suspend fun remove(
        @Path("id") id: String,
        @Path("requestId") requestId: String,
    ): Unit

    /** `POST /api/plans/:id/on-my-way`: a system line in the chat, no push. */
    @POST("api/plans/{id}/on-my-way")
    suspend fun onMyWay(
        @Path("id") id: String,
    ): Unit

    /** `POST /api/plans/:id/still-coming`: the answer to "Still coming?". */
    @POST("api/plans/{id}/still-coming")
    suspend fun stillComing(
        @Path("id") id: String,
        @Body body: StillComingBody,
    ): Unit

    /** `POST /api/plans/:id/report`: "Report this plan" (J1, J2); the generic post report can't see plan posts. */
    @POST("api/plans/{id}/report")
    suspend fun report(
        @Path("id") id: String,
        @Body body: PlanReportBody,
    ): Unit

    /** `POST /api/plans/:id/feedback`: "How was it" (A5). */
    @POST("api/plans/{id}/feedback")
    suspend fun feedback(
        @Path("id") id: String,
        @Body body: PlanFeedbackBody,
    ): Unit

    /** `GET /api/public/plans/:id`: the signed-out card (a playdate says only its kind and city). */
    @GET("api/public/plans/{id}")
    suspend fun publicPlan(
        @Path("id") id: String,
    ): PublicPlanDto

    /** `GET /api/plans/games`: upcoming games for the next 14 days. */
    @GET("api/plans/games")
    suspend fun games(): PlanGamesResponse

    /**
     * `GET /api/plans/places/nearby`: public places for H6, nearest first. A first ask for an area may answer 202
     * `{ loading: true }` with no places while the source is slow: ask again in a few seconds.
     */
    @GET("api/plans/places/nearby")
    suspend fun nearbyPlaces(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("q") query: String? = null,
    ): PlanNearbyPlacesResponse
}
