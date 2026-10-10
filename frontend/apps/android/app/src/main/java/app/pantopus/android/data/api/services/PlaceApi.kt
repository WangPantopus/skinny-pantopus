package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.AddressCalendarResponse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Tag

/**
 * Place Intelligence endpoints — the living dashboard
 * (`backend/routes/placeIntelligence.js`) and the anonymous T0
 * preview (`backend/routes/public.js`).
 */
interface PlaceApi {
    /**
     * The grouped section envelopes for a saved/claimed/verified place
     * (T1–T4; tier and per-section gating resolved server-side). Pass
     * `sections` as a comma-joined id list to lazy-load a subset (e.g.
     * a detail page refreshing only its own group); null ⇒ the full
     * launch set. Route `backend/routes/placeIntelligence.js:37`.
     *
     * Every request carries `ballot=1`, the client opt-in for the Ballot P0
     * payload (the server adds the `civic_election` card and `civic_districts`
     * governments only when it is present and `ballot_p0` is on for the
     * viewer), so a build without Ballot never sees Ballot semantics.
     */
    @GET("api/homes/{id}/intelligence?ballot=1")
    suspend fun intelligence(
        @Path("id") homeId: String,
        @Query("sections") sections: String? = null,
    ): PlaceIntelligence

    /** [intelligence] for the screens' store: sends the stored ETag; a 304 means the stored copy is current. */
    @GET("api/homes/{id}/intelligence?ballot=1")
    suspend fun intelligenceConditional(
        @Path("id") homeId: String,
        @Query("sections") sections: String?,
        @Header("If-None-Match") etag: String?,
    ): Response<PlaceIntelligence>

    /**
     * The anonymous, address-only T0 preview — no account required,
     * non-persistent (no DB writes). Returns the free Band-A subset
     * live (flood, density bucket, area teaser) with everything
     * recurring or exact as a locked descriptor. Rate-limited
     * server-side (`previewLimiter`). Route `backend/routes/public.js:377`.
     */
    @GET("api/public/place")
    suspend fun publicPreview(
        @Query("address") address: String,
    ): PlacePreview

    // ─── Address calendar (Wedge v2 D6) ────────────────────────

    /** `GET /api/homes/:id/calendar` — route `backend/routes/addressCalendar.js:41`. */
    @GET("api/homes/{id}/calendar")
    suspend fun addressCalendar(
        @Path("id") homeId: String,
    ): AddressCalendarResponse

    /** `PUT /api/homes/:id/calendar/pickup-day` — route `backend/routes/addressCalendar.js:53`. */
    @PUT("api/homes/{id}/calendar/pickup-day")
    suspend fun setPickupDay(
        @Path("id") homeId: String,
        @Body body: SetPickupDayRequest,
        @Tag dispatchGuard: AuthenticatedDispatchGuard? = null,
    ): AddressCalendarResponse

    /** `DELETE /api/homes/:id/calendar/pickup-day[?expected_version=]` — route `backend/routes/addressCalendar.js`. */
    @DELETE("api/homes/{id}/calendar/pickup-day")
    suspend fun clearPickupDay(
        @Path("id") homeId: String,
        @Query("expected_version") expectedVersion: String? = null,
        @Tag dispatchGuard: AuthenticatedDispatchGuard? = null,
    ): AddressCalendarResponse
}
