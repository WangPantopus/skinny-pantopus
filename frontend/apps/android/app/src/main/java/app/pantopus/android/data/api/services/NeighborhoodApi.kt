package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

/** Nearby — the density door and its window (Wedge v2 D2 / §4). */
interface NeighborhoodApi {
    /** `GET /api/neighborhood/meter` — route `backend/routes/neighborhood.js:95`. */
    @GET("api/neighborhood/meter")
    suspend fun meter(): NeighborhoodMeter

    /** `GET /api/neighborhood/cells` — route `backend/routes/neighborhood.js` (the window). */
    @GET("api/neighborhood/cells")
    suspend fun cells(): NeighborhoodCells

    /** [meter] for the screens' store: sends the stored ETag; a 304 means the copy is current. */
    @GET("api/neighborhood/meter")
    suspend fun meterConditional(
        @Header("If-None-Match") etag: String?,
    ): Response<NeighborhoodMeter>

    /** [cells] for the screens' store. */
    @GET("api/neighborhood/cells")
    suspend fun cellsConditional(
        @Header("If-None-Match") etag: String?,
    ): Response<NeighborhoodCells>
}
