package app.pantopus.android.data.relationships

import app.pantopus.android.data.api.models.relationships.ConnectionRequestBody
import app.pantopus.android.data.api.models.relationships.ConnectionRequestResponse
import app.pantopus.android.data.api.models.relationships.PendingRequestsResponse
import app.pantopus.android.data.api.models.relationships.RelationshipActionEcho
import app.pantopus.android.data.api.models.relationships.RelationshipsListResponse
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
    ) {
        /**
         * `GET /api/relationships` — list my relationships, optionally
         * filtered by status. Route `backend/routes/relationships.js:622`.
         */
        suspend fun list(
            status: String? = null,
            limit: Int = 50,
            offset: Int = 0,
        ): NetworkResult<RelationshipsListResponse> =
            safeApiCall {
                api.list(status = status, limit = limit, offset = offset)
            }

        /**
         * `GET /api/relationships/requests/pending` — list pending
         * connection requests received by me. Route
         * `backend/routes/relationships.js:669`.
         */
        suspend fun pendingRequests(): NetworkResult<PendingRequestsResponse> = safeApiCall { api.pendingRequests() }

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
            }

        /**
         * `POST /api/relationships/:id/accept` — accept an inbound
         * connection request. Route `backend/routes/relationships.js:217`.
         */
        suspend fun accept(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.accept(id) }

        /**
         * `POST /api/relationships/:id/reject` — reject (decline) an
         * inbound request. Route `backend/routes/relationships.js:295`.
         */
        suspend fun reject(id: String): NetworkResult<RelationshipActionEcho> = safeApiCall { api.reject(id) }
    }
