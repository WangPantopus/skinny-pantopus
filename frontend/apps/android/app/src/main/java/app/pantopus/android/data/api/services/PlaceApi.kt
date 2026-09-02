package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.AddressCalendarResponse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

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
     */
    @GET("api/homes/{id}/intelligence")
    suspend fun intelligence(
        @Path("id") homeId: String,
        @Query("sections") sections: String? = null,
    ): PlaceIntelligence

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
    ): AddressCalendarResponse

    /** `DELETE /api/homes/:id/calendar/pickup-day` — route `backend/routes/addressCalendar.js:70`. */
    @DELETE("api/homes/{id}/calendar/pickup-day")
    suspend fun clearPickupDay(
        @Path("id") homeId: String,
    ): AddressCalendarResponse
}
