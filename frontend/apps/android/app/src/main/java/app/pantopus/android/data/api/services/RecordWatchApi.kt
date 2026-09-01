package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.place.RecordWatchResponse
import app.pantopus.android.data.api.models.place.RemoveRecordWatchResponse
import app.pantopus.android.data.api.models.place.SetRecordWatchRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Path

/**
 * Home Record Watch — the rate-watch half. Route
 * `backend/routes/homeRecordWatch.js` (mounted under `/api/homes`).
 * Watches are personal per home+user.
 */
interface RecordWatchApi {
    /**
     * Set or replace (verified T4 occupants only).
     * Route `backend/routes/homeRecordWatch.js:27`.
     */
    @PUT("api/homes/{id}/record-watch")
    suspend fun set(
        @Path("id") homeId: String,
        @Body body: SetRecordWatchRequest,
    ): RecordWatchResponse

    /**
     * The caller's watch with a live evaluation, or `{"watch": null}`.
     * Route `backend/routes/homeRecordWatch.js:61`.
     */
    @GET("api/homes/{id}/record-watch")
    suspend fun get(
        @Path("id") homeId: String,
    ): RecordWatchResponse

    /** Route `backend/routes/homeRecordWatch.js:79`. */
    @DELETE("api/homes/{id}/record-watch")
    suspend fun remove(
        @Path("id") homeId: String,
    ): RemoveRecordWatchResponse
}
