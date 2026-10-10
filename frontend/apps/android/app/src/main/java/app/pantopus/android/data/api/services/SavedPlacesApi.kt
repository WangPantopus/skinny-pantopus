package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.saved_places.SavePlaceBody
import app.pantopus.android.data.api.models.saved_places.SavedPlaceDeleteResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlaceResponse
import app.pantopus.android.data.api.models.saved_places.SavedPlacesListResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Saved places and their owner-scoped public Today information.
 */
interface SavedPlacesApi {
    /**
     * `GET /api/saved-places` — the signed-in user's saved places, newest
     * first. Route `backend/routes/savedPlaces.js:8`.
     */
    @GET("api/saved-places")
    suspend fun list(): SavedPlacesListResponse

    @GET("api/saved-places")
    suspend fun listConditional(
        @Header("If-None-Match") etag: String?,
    ): Response<SavedPlacesListResponse>

    @GET("api/saved-places/{id}/today")
    suspend fun todayConditional(
        @Path("id") id: String,
        @Header("If-None-Match") etag: String?,
    ): Response<PlaceIntelligence>

    @GET("api/saved-places/{id}/today")
    suspend fun today(
        @Path("id") id: String,
    ): PlaceIntelligence

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
