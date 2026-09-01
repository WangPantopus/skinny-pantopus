package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.location.SetViewingLocationRequest
import app.pantopus.android.data.api.models.location.SetViewingLocationResponse
import app.pantopus.android.data.api.models.location.SetViewingRadiusRequest
import app.pantopus.android.data.api.models.location.SetViewingRadiusResponse
import app.pantopus.android.data.api.models.location.ViewingLocationPayload
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT

/**
 * The user's Viewing Location — the place the Nearby feed, Gigs and
 * Discover are scoped to. Mounted at `/api/location`
 * (`backend/app.js:387`).
 */
interface ViewingLocationApi {
    /**
     * `GET /api/location` — current viewing location plus the pickers'
     * source lists (recents, homes, business locations).
     * Route `backend/routes/location.js:89`.
     */
    @GET("api/location")
    suspend fun current(): ViewingLocationPayload

    /**
     * `PUT /api/location` — upsert the viewing location. The handler also
     * pushes the value onto the recents list (deduped, trimmed to 5).
     * Route `backend/routes/location.js:149`.
     */
    @PUT("api/location")
    suspend fun set(
        @Body body: SetViewingLocationRequest,
    ): SetViewingLocationResponse

    /**
     * `PUT /api/location/radius` — change only the radius of the current
     * viewing location. 404s when nothing is set yet.
     * Route `backend/routes/location.js:268`.
     */
    @PUT("api/location/radius")
    suspend fun setRadius(
        @Body body: SetViewingRadiusRequest,
    ): SetViewingRadiusResponse
}
