package app.pantopus.android.data.homes

import app.pantopus.android.data.api.models.homes.CreateHomeIssueRequest
import app.pantopus.android.data.api.models.homes.HomeIssueResponse
import app.pantopus.android.data.api.models.homes.HomeIssuesResponse
import app.pantopus.android.data.api.models.homes.UpdateHomeIssueRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.HomeIssuesApi
import app.pantopus.android.data.store.HomeStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.Stored
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
        private val store: ScreenStore,
    ) {
        /** `GET /api/homes/:id/issues`. */
        open suspend fun getHomeIssues(homeId: String): NetworkResult<HomeIssuesResponse> = safeApiCall { api.getHomeIssues(homeId) }

        /** [getHomeIssues] through the screens' store: a fresh copy answers without a request. */
        open suspend fun getHomeIssuesStored(
            homeId: String,
            force: Boolean = false,
        ): Stored<HomeIssuesResponse> =
            store.read(HomeStoreKeys.issues(homeId), force) { etag -> conditionalApiCall { api.getHomeIssuesConditional(homeId, etag) } }

        /** The stored issues, without a request. */
        open fun storedIssues(homeId: String): HomeIssuesResponse? = store.peek(HomeStoreKeys.issues(homeId)).data

        /** `POST /api/homes/:id/issues`. */
        open suspend fun createHomeIssue(
            homeId: String,
            request: CreateHomeIssueRequest,
        ): NetworkResult<HomeIssueResponse> = safeApiCall { api.createHomeIssue(homeId, request) }.alsoMarkStale(homeId)

        /** `PUT /api/homes/:id/issues/:issueId`. */
        open suspend fun updateHomeIssue(
            homeId: String,
            issueId: String,
            request: UpdateHomeIssueRequest,
        ): NetworkResult<HomeIssueResponse> = safeApiCall { api.updateHomeIssue(homeId, issueId, request) }.alsoMarkStale(homeId)

        /** Own edit: this Home's stored screens read again on their next use. */
        private fun <T> NetworkResult<T>.alsoMarkStale(homeId: String): NetworkResult<T> =
            also { if (it is NetworkResult.Success) store.markStale("home:$homeId") }
    }
