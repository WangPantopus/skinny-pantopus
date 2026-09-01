package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.relationships.ConnectionRequestBody
import app.pantopus.android.data.api.models.relationships.ConnectionRequestResponse
import app.pantopus.android.data.api.models.relationships.PendingRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.models.relationships.RelationshipsListResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * `/api/relationships/[*]` — trust-graph endpoints from
 * `backend/routes/relationships.js`. Mounted at `/api/relationships`
 * (see `backend/app.js:347`).
 */
interface RelationshipsApi {
    /**
     * `GET /api/relationships` — list my relationships, optionally
     * filtered by status. Route `backend/routes/relationships.js:622`.
     */
    @GET("api/relationships")
    suspend fun list(
        @Query("status") status: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
    ): RelationshipsListResponse

    /**
     * `GET /api/relationships/requests/pending` — list pending requests
     * received by me. Route `backend/routes/relationships.js:669`.
     */
    @GET("api/relationships/requests/pending")
    suspend fun pendingRequests(): PendingRequestsResponse

    /**
     * `POST /api/relationships/requests` — send a connection request
     * to another user. Route `backend/routes/relationships.js:67`.
     */
    @POST("api/relationships/requests")
    suspend fun sendRequest(
        @Body body: ConnectionRequestBody,
    ): ConnectionRequestResponse

    /**
     * `POST /api/relationships/:id/accept` — accept an inbound request.
     * Route `backend/routes/relationships.js:217`.
     */
    @POST("api/relationships/{id}/accept")
    suspend fun accept(
        @Path("id") id: String,
    ): RelationshipActionEcho

    /**
     * `POST /api/relationships/:id/reject` — decline an inbound request.
     * Route `backend/routes/relationships.js:295`.
     */
    @POST("api/relationships/{id}/reject")
    suspend fun reject(
        @Path("id") id: String,
    ): RelationshipActionEcho
}
