package app.pantopus.android.data.sports

import app.pantopus.android.data.api.models.sports.ActiveSportsEventsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.SportsApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [SportsApi] in the [NetworkResult] taxonomy. */
@Singleton
class SportsRepository
    @Inject
    constructor(
        private val api: SportsApi,
    ) {
        /** `GET /api/sports/active-events`. */
        suspend fun activeEvents(): NetworkResult<ActiveSportsEventsResponse> = safeApiCall { api.activeEvents() }
    }
