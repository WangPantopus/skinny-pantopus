package app.pantopus.android.data.connections

import app.pantopus.android.data.api.models.connections.BlockedRelationshipsResponse
import app.pantopus.android.data.api.models.connections.SentRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ConnectionsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * S5 — wraps the Sent / Blocked / disconnect / unblock half of
 * `/api/relationships` in the [NetworkResult] taxonomy. The list /
 * pending / accept / reject half stays in `RelationshipsRepository`.
 */
@Singleton
class ConnectionsRepository
    @Inject
    constructor(
        private val api: ConnectionsApi,
    ) {
        /**
         * `GET /api/relationships/requests/sent` — outbound pending
         * requests. Route `backend/routes/relationships.js:698`.
         */
        suspend fun sentRequests(): NetworkResult<SentRequestsResponse> = safeApiCall { api.sentRequests() }

        /**
         * `GET /api/relationships/blocked` — people the viewer blocked.
         * Route `backend/routes/relationships.js:727`.
         */
        suspend fun blocked(): NetworkResult<BlockedRelationshipsResponse> = safeApiCall { api.blocked() }

        /**
         * `DELETE /api/relationships/:id` — disconnect an accepted
         * relationship. Route `backend/routes/relationships.js:578`.
         */
        suspend fun disconnect(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.disconnect(id) }

        /**
         * `POST /api/relationships/:id/unblock` — lift a block. Route
         * `backend/routes/relationships.js:522`.
         */
        suspend fun unblock(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.unblock(id) }
    }
