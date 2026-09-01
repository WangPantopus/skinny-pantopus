package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.HomeUnlistedResponse
import app.pantopus.android.data.api.models.place.PublicUnlistedResponse
import app.pantopus.android.data.api.models.place.SetUnlistedRemovalRequest
import app.pantopus.android.data.api.models.place.UnlistedRemovalResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Unlisted (Wave 4) — the state's escape hatch plus the verified
 * removal paths off the sites that republish county property records.
 *
 * We never query those sites: doing so would hand them the address the
 * caller is trying to remove. Nothing on this interface asks whether
 * someone IS listed, because we do not possess that fact.
 */
interface UnlistedApi {
    /**
     * Anonymous (T0). Persists NOTHING — the address resolves to a
     * state and is never stored. Non-US answers
     * `status: "unsupported_region"` with a message.
     * Route `backend/routes/public.js:567`.
     */
    @GET("api/public/unlisted")
    suspend fun publicUnlisted(
        @Query("address") address: String,
    ): PublicUnlistedResponse

    /**
     * The state profile plus THIS CALLER's removal progress. Gated on
     * home access, NOT on verification — someone who has just claimed
     * their address is exactly who needs it.
     *
     * `unlisted.removals` is null when the progress read FAILED, which
     * is not the same as the empty list meaning "nothing done yet".
     * Route `backend/routes/unlisted.js:31`.
     */
    @GET("api/homes/{id}/unlisted")
    suspend fun forHome(
        @Path("id") homeId: String,
    ): HomeUnlistedResponse

    /**
     * Record where the resident has got to with one broker. The removal
     * itself happens on the broker's own site — this is bookkeeping
     * they own, never a claim we act on their behalf. 400
     * `UNKNOWN_BROKER` / `BAD_STATUS`.
     * Route `backend/routes/unlisted.js:64`.
     */
    @PUT("api/homes/{id}/unlisted/removals/{brokerId}")
    suspend fun setRemoval(
        @Path("id") homeId: String,
        @Path("brokerId") brokerId: String,
        @Body body: SetUnlistedRemovalRequest,
    ): UnlistedRemovalResponse
}
