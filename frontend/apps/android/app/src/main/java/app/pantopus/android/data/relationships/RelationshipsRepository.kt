package app.pantopus.android.data.relationships

import app.pantopus.android.data.api.models.relationships.ConnectionRequestBody
import app.pantopus.android.data.api.models.relationships.ConnectionRequestResponse
import app.pantopus.android.data.api.models.relationships.PendingRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.models.relationships.RelationshipsListResponse
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.RelationshipsApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps `/api/relationships/[*]` calls in the [NetworkResult] taxonomy. */
@Singleton
class RelationshipsRepository
    @Inject
    constructor(
        private val api: RelationshipsApi,
        private val store: ScreenStore,
    ) {
        /**
         * `GET /api/relationships` — list my relationships, optionally
         * filtered by status. Route `backend/routes/relationships.js:622`.
         */
        suspend fun list(
            status: String? = null,
            limit: Int = 50,
            offset: Int = 0,
            force: Boolean = false,
        ): NetworkResult<RelationshipsListResponse> {
            if (offset != 0) return safeApiCall { api.list(status = status, limit = limit, offset = offset) }
            val stored = store.read(StoreKeys.relationships(status, limit, offset), force) { etag ->
                conditionalApiCall { api.listConditional(status, limit, offset, etag) }
            }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun listCopy(status: String?, limit: Int = 50): Stored<RelationshipsListResponse> = store.peek(StoreKeys.relationships(status, limit))

        /**
         * `GET /api/relationships/requests/pending` — list pending
         * connection requests received by me. Route
         * `backend/routes/relationships.js:669`.
         */
        suspend fun pendingRequests(force: Boolean = false): NetworkResult<PendingRequestsResponse> {
            val stored = store.read(StoreKeys.pendingConnections, force) { etag -> conditionalApiCall { api.pendingRequestsConditional(etag) } }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun pendingCopy(): Stored<PendingRequestsResponse> = store.peek(StoreKeys.pendingConnections)

        /**
         * `POST /api/relationships/requests` — send a connection request.
         * Route `backend/routes/relationships.js:67`.
         */
        suspend fun sendRequest(
            addresseeId: String,
            message: String? = null,
        ): NetworkResult<ConnectionRequestResponse> =
            safeApiCall {
                api.sendRequest(ConnectionRequestBody(addresseeId = addresseeId, message = message))
            }.changed()

        /**
         * `POST /api/relationships/:id/accept` — accept an inbound
         * connection request. Route `backend/routes/relationships.js:217`.
         */
        suspend fun accept(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.accept(id) }.changed()

        /**
         * `POST /api/relationships/:id/reject` — reject (decline) an
         * inbound request. Route `backend/routes/relationships.js:295`.
         */
        suspend fun reject(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.reject(id) }.changed()
        private fun <T> NetworkResult<T>.changed(): NetworkResult<T> = also {
            if (it is NetworkResult.Success) store.markEdited(StoreTopics.PROFILE_ME)
        }
    }
