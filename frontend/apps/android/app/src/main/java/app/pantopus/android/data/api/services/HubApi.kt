package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.hub.BriefingDeliveryResponse
import app.pantopus.android.data.api.models.hub.HubDiscoveryResponse
import app.pantopus.android.data.api.models.hub.HubResponse
import app.pantopus.android.data.api.models.hub.HubTodayPayload
import app.pantopus.android.data.api.models.hub.HubTodayResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/** Hub routes from `backend/routes/hub.js`. */
interface HubApi {
    /** `GET /api/hub` — route `backend/routes/hub.js:24`. */
    @GET("api/hub")
    suspend fun overview(): HubResponse

    /** `GET /api/hub/today` — route `backend/routes/hub.js:596`. */
    @GET("api/hub/today")
    suspend fun today(): HubTodayResponse

    /**
     * `GET /api/hub/today` (typed) — route `backend/routes/hub.js:596`. Backs
     * the full-screen Today briefing; the payload is serialized at the top
     * level on success (no `today` wrapper).
     */
    @GET("api/hub/today")
    suspend fun todayDetail(): HubTodayPayload

    /**
     * `GET /api/hub/briefings/:id` — a stored Morning/Evening Briefing
     * delivery, scoped to the signed-in user. The push notification for
     * `morning_briefing` / `evening_briefing` carries the delivery id in
     * `metadata.briefing_delivery_id`; opening it must resolve that briefing
     * rather than refetching the live Today snapshot.
     * Route `backend/routes/hub.js:612`.
     */
    @GET("api/hub/briefings/{id}")
    suspend fun briefingDelivery(
        @Path("id") id: String,
    ): BriefingDeliveryResponse

    /**
     * `GET /api/hub/discovery` — route `backend/routes/hub.js:757`.
     *
     * T5.4.1 chip-strip filters for the Discover hub: `since=today`
     * keeps items created in the last 24h; `verified=true` filters to
     * verified people / published businesses; `freeOrWanted=true`
     * filters listings to `price=0` / `is_wanted=true` (and gigs to
     * `price=0`).
     */
    @GET("api/hub/discovery")
    suspend fun discovery(
        @Query("filter") filter: String,
        @Query("lat") lat: Double? = null,
        @Query("lng") lng: Double? = null,
        @Query("limit") limit: Int = 10,
        @Query("since") since: String? = null,
        @Query("verified") verified: Boolean? = null,
        @Query("freeOrWanted") freeOrWanted: Boolean? = null,
    ): HubDiscoveryResponse
}
