package app.pantopus.android.data.connections

import app.pantopus.android.data.api.models.connections.BlockedRelationshipsResponse
import app.pantopus.android.data.api.models.connections.SentRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ConnectionsApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
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
        private val store: ScreenStore,
    ) {
        /**
         * `GET /api/relationships/requests/sent` — outbound pending
         * requests. Route `backend/routes/relationships.js:698`.
         */
        suspend fun sentRequests(force: Boolean = false): NetworkResult<SentRequestsResponse> {
            val stored = store.read(StoreKeys.sentConnections, force) { etag -> conditionalApiCall { api.sentRequestsConditional(etag) } }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun sentCopy(): Stored<SentRequestsResponse> = store.peek(StoreKeys.sentConnections)

        /**
         * `GET /api/relationships/blocked` — people the viewer blocked.
         * Route `backend/routes/relationships.js:727`.
         */
        suspend fun blocked(force: Boolean = false): NetworkResult<BlockedRelationshipsResponse> {
            val stored = store.read(StoreKeys.blockedConnections, force) { etag -> conditionalApiCall { api.blockedConditional(etag) } }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun blockedCopy(): Stored<BlockedRelationshipsResponse> = store.peek(StoreKeys.blockedConnections)

        /**
         * `DELETE /api/relationships/:id` — disconnect an accepted
         * relationship. Route `backend/routes/relationships.js:578`.
         */
        suspend fun disconnect(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.disconnect(id) }.changed()

        /**
         * `POST /api/relationships/:id/unblock` — lift a block. Route
         * `backend/routes/relationships.js:522`.
         */
        suspend fun unblock(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.unblock(id) }.changed()

        private fun <T> NetworkResult<T>.changed(): NetworkResult<T> =
            also {
                if (it is NetworkResult.Success) store.markEdited(StoreTopics.PROFILE_ME)
            }
    }
