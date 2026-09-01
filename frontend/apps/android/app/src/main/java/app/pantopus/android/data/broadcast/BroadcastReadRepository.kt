package app.pantopus.android.data.broadcast

import app.pantopus.android.data.api.models.broadcast.BroadcastReadResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.BroadcastReadApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [BroadcastReadApi] in the `NetworkResult` taxonomy. */
@Singleton
class BroadcastReadRepository
    @Inject
    constructor(
        private val api: BroadcastReadApi,
    ) {
        suspend fun markRead(messageId: String): NetworkResult<BroadcastReadResponse> = safeApiCall { api.markRead(messageId) }
    }
