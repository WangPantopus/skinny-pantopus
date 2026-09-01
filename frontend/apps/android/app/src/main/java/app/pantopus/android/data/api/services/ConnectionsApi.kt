package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.connections.BlockedRelationshipsResponse
import app.pantopus.android.data.api.models.connections.SentRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * S5 — the `/api/relationships/…` routes the native Connections center
 * was missing: outbound ("Sent") requests, the blocked list, disconnect,
 * and unblock. Kept out of [RelationshipsApi] so parallel feature work
 * doesn't collide; the shared `RelationshipUserDto` /
 * `RelationshipActionEcho` shapes are reused from
 * `data.api.models.relationships`.
 *
 * Mounted at `/api/relationships` (`backend/app.js:352`); declarations
 * live in `backend/routes/relationships.js`.
 */
interface ConnectionsApi {
    /**
     * `GET /api/relationships/requests/sent` — outbound pending requests.
     * Route `backend/routes/relationships.js:698`. Returns
     * `{ requests: [{ id, status, created_at, addressee }] }`.
     */
    @GET("api/relationships/requests/sent")
    suspend fun sentRequests(): SentRequestsResponse

    /**
     * `GET /api/relationships/blocked` — people the viewer has blocked.
     * Route `backend/routes/relationships.js:727`. Each row is enriched
     * server-side with `blocked_user` (`relationships.js:747-750`).
     */
    @GET("api/relationships/blocked")
    suspend fun blocked(): BlockedRelationshipsResponse

    /**
     * `DELETE /api/relationships/:id` — disconnect an accepted
     * relationship. Route `backend/routes/relationships.js:578`. The
     * handler 400s on a blocked row ("Unblock first"), so never call this
     * from the Blocked tab.
     */
    @DELETE("api/relationships/{id}")
    suspend fun disconnect(
        @Path("id") id: String,
    ): RelationshipActionEcho

    /**
     * `POST /api/relationships/:id/unblock` — lift a block. Route
     * `backend/routes/relationships.js:522`. Only the blocker may unblock
     * (403 otherwise); the row is deleted outright so the pair can
     * re-request.
     */
    @POST("api/relationships/{id}/unblock")
    suspend fun unblock(
        @Path("id") id: String,
    ): RelationshipActionEcho
}
