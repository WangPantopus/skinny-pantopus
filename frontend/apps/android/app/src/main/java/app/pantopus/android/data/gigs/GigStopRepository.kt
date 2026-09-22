package app.pantopus.android.data.gigs

import app.pantopus.android.data.api.models.gigs.GigStopCommand
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GigStopApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GigStopRepository
    @Inject
    constructor(private val api: GigStopApi) {
        suspend fun preview(
            gigId: String,
            action: String,
        ) = safeApiCall { api.preview(gigId, action) }

        suspend fun request(
            gigId: String,
            requestId: String,
        ) = safeApiCall { api.request(gigId, requestId) }

        suspend fun submit(
            gigId: String,
            command: GigStopCommand,
        ) = safeApiCall { api.submit(gigId, command) }
    }
