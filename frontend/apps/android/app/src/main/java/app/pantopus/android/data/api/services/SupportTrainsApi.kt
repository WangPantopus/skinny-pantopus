package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.support_trains.AddSupportTrainSlotBody
import app.pantopus.android.data.api.models.support_trains.CreateSupportTrainBody
import app.pantopus.android.data.api.models.support_trains.CreateSupportTrainResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainDetailDto
import app.pantopus.android.data.api.models.support_trains.SupportTrainReservationsResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainUpdateBody
import app.pantopus.android.data.api.models.support_trains.SupportTrainsListResponse
import app.pantopus.android.data.api.models.support_trains.SupportTrainsNearbyResponse
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * `api/activities/support-trains/…` — Support Trains (mutual-aid)
 * endpoints from `backend/routes/supportTrains.js`.
 *
 * S1 PREFIX FIX: these paths used to be `api/support-trains/…`.
 * `backend/app.js:404` mounts the router at
 * `/api/activities/support-trains` and no alias for the shorter prefix
 * exists anywhere in the backend, so every call 404'd. They now compose
 * the real mount, matching the RN client
 * (`packages/api/src/endpoints/supportTrains.ts:30`).
 *
 * The write half (reserve / cancel / reveal / deliver / confirm plus
 * the organizer management actions) lives in [SupportTrainActionsApi].
 */
interface SupportTrainsApi {
    /**
     * `GET /api/support-trains/me/support-trains` — list trains the
     * caller participates in (organizer or helper). Route
     * `backend/routes/supportTrains.js:445`.
     */
    @GET("api/activities/support-trains/me/support-trains")
    suspend fun mine(
        @Query("role") role: String? = null,
        @Query("status") status: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
    ): SupportTrainsListResponse

    /**
     * `GET /api/support-trains/nearby` — list trains visible nearby
     * (default 25 mi radius). Route
     * `backend/routes/supportTrains.js:570`.
     */
    @GET("api/activities/support-trains/nearby")
    suspend fun nearby(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius_meters") radiusMeters: Double? = null,
        @Query("limit") limit: Int = 40,
    ): SupportTrainsNearbyResponse

    /**
     * `GET /api/support-trains/:id/reservations` — organizer-only feed
     * of pending / confirmed helper reservations. Route
     * `backend/routes/supportTrains.js:3306`.
     */
    @GET("api/activities/support-trains/{id}/reservations")
    suspend fun reservations(
        @Path("id") supportTrainId: String,
    ): SupportTrainReservationsResponse

    /**
     * `POST /api/support-trains/` — create a new Support Train
     * (status `draft`). P2.6 — the Start-a-Support-Train wizard fires
     * this on launch, then [addSlot] for each generated slot, then
     * [publish]. Route `backend/routes/supportTrains.js:639`.
     */
    @POST("api/activities/support-trains")
    suspend fun create(
        @Body body: CreateSupportTrainBody,
    ): CreateSupportTrainResponse

    /**
     * `POST /api/support-trains/:id/slots` — append one custom slot.
     * The wizard calls this once per generated slot. Route
     * `backend/routes/supportTrains.js:921`.
     */
    @POST("api/activities/support-trains/{id}/slots")
    suspend fun addSlot(
        @Path("id") supportTrainId: String,
        @Body body: AddSupportTrainSlotBody,
    ): ResponseBody

    /**
     * `POST /api/support-trains/:id/publish` — flip the draft to
     * `published` so neighbors / connections can sign up. Fires last
     * in the wizard's launch sequence. Route
     * `backend/routes/supportTrains.js:1236`.
     */
    @POST("api/activities/support-trains/{id}/publish")
    suspend fun publish(
        @Path("id") supportTrainId: String,
    ): ResponseBody

    /**
     * `GET /api/support-trains/:id` — participant-facing detail (A10.9).
     * Privacy-gated: slots / my-reservations / updates / organizers are
     * scoped to the viewer's role. Route
     * `backend/routes/supportTrains.js:3444`.
     *
     * PREFIX NOTE (resolved in S1): the family used to target
     * `api/support-trains/{...}`; the router is mounted at
     * `/api/activities/support-trains` (`backend/app.js:404`) with no
     * alias, so every helper here composes the real mount.
     */
    @GET("api/activities/support-trains/{id}")
    suspend fun detail(
        @Path("id") supportTrainId: String,
    ): SupportTrainDetailDto

    /**
     * `POST /api/support-trains/:id/updates` — broadcast an update to the
     * train's helpers (A13.13 Manage → Send update). Route
     * `backend/routes/supportTrains.js:1581`.
     */
    @POST("api/activities/support-trains/{id}/updates")
    suspend fun postUpdate(
        @Path("id") supportTrainId: String,
        @Body body: SupportTrainUpdateBody,
    ): ResponseBody

    /**
     * `POST /api/support-trains/:id/complete` — mark the train completed
     * (A13.13 Manage → Close train). Route
     * `backend/routes/supportTrains.js:1508`.
     */
    @POST("api/activities/support-trains/{id}/complete")
    suspend fun complete(
        @Path("id") supportTrainId: String,
    ): ResponseBody
}
