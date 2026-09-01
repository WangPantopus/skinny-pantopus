package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import retrofit2.http.GET
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
}
