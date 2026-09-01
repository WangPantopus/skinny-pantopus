package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDeleteResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlaceResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlacesListResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * BLOCK 2E — "Saved places". All three routes already exist on the backend
 * (mounted at `/api/saved-places` in `backend/app.js:389`); this screen does
 * not change any server behaviour.
 */
interface SavedPlacesApi {
    /**
     * `GET /api/saved-places` — the signed-in user's saved places, newest
     * first. Route `backend/routes/savedPlaces.js:8`.
     */
    @GET("api/saved-places")
    suspend fun list(): SavedPlacesListResponse

    /**
     * `POST /api/saved-places` — upsert a saved place on
     * `(user, latitude, longitude)`. Returns `201` with the upserted row.
     * Route `backend/routes/savedPlaces.js:25`.
     */
    @POST("api/saved-places")
    suspend fun save(
        @Body body: SavePlaceBody,
    ): SavedPlaceResponse

    /**
     * `DELETE /api/saved-places/:id` — remove one saved place (scoped to the
     * caller). Route `backend/routes/savedPlaces.js:64`.
     */
    @DELETE("api/saved-places/{id}")
    suspend fun remove(
        @Path("id") id: String,
    ): SavedPlaceDeleteResponse
}
