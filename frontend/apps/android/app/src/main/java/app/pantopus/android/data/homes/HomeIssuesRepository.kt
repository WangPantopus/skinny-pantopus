package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeIssueRequest
import app.pantopus.android.data.api.models.homes.HomeIssueResponse
import app.pantopus.android.data.api.models.homes.HomeIssuesResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeIssueRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeIssuesApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around the per-home issue-tracker endpoints. Kept
 * separate from [HomesRepository] so the broader homes facade does not
 * grow with each home sub-surface — and separate from the maintenance
 * task calls, which hit a different backend collection entirely.
 */
@Singleton
open class HomeIssuesRepository
    @Inject
    constructor(
        private val api: HomeIssuesApi,
    ) {
        /** `GET /api/homes/:id/issues`. */
        open suspend fun getHomeIssues(homeId: String): NetworkResult<HomeIssuesResponse> = safeApiCall { api.getHomeIssues(homeId) }

        /** `POST /api/homes/:id/issues`. */
        open suspend fun createHomeIssue(
            homeId: String,
            request: CreateHomeIssueRequest,
        ): NetworkResult<HomeIssueResponse> = safeApiCall { api.createHomeIssue(homeId, request) }

        /** `PUT /api/homes/:id/issues/:issueId`. */
        open suspend fun updateHomeIssue(
            homeId: String,
            issueId: String,
            request: UpdateHomeIssueRequest,
        ): NetworkResult<HomeIssueResponse> = safeApiCall { api.updateHomeIssue(homeId, issueId, request) }
    }
