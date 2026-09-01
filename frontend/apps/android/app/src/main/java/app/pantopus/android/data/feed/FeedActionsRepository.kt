package app.pantopus.android.data.feed

import app.pantopus.android.data.api.models.feed.FeedActionAckResponse
import app.pantopus.android.data.api.models.feed.FeedMuteEntityType
import app.pantopus.android.data.api.models.feed.FeedMuteRequest
import app.pantopus.android.data.api.models.feed.FeedMuteTopicRequest
import app.pantopus.android.data.api.models.feed.FeedNotHelpfulRequest
import app.pantopus.android.data.api.models.feed.FeedNotHelpfulResponse
import app.pantopus.android.data.api.models.feed.FeedPreferencesResponse
import app.pantopus.android.data.api.models.feed.FeedPreferencesUpdateRequest
import app.pantopus.android.data.api.models.feed.FeedSeededDismissResponse
import app.pantopus.android.data.api.models.feed.FeedSolveResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.FeedActionsApi
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [FeedActionsApi] in the [NetworkResult] taxonomy. */
@Singleton
class FeedActionsRepository
    @Inject
    constructor(
        private val api: FeedActionsApi,
    ) {
        /** `POST /api/posts/hide/:id`. */
        suspend fun hidePost(id: String): NetworkResult<FeedActionAckResponse> = safeApiCall { api.hidePost(id) }

        /** `POST /api/posts/mute`. */
        suspend fun mute(
            entityType: FeedMuteEntityType,
            entityId: String,
        ): NetworkResult<FeedActionAckResponse> =
            safeApiCall {
                api.mute(FeedMuteRequest(entityType = entityType.wireValue, entityId = entityId))
            }

        /** `DELETE /api/posts/mute`. */
        suspend fun unmute(
            entityType: FeedMuteEntityType,
            entityId: String,
        ): NetworkResult<FeedActionAckResponse> =
            safeApiCall {
                api.unmute(FeedMuteRequest(entityType = entityType.wireValue, entityId = entityId))
            }

        /** `POST /api/posts/mute/topic`. */
        suspend fun muteTopic(
            postType: String,
            surface: String?,
        ): NetworkResult<FeedActionAckResponse> =
            safeApiCall {
                api.muteTopic(FeedMuteTopicRequest(postType = postType, surface = surface))
            }

        /** `POST /api/posts/:id/not-helpful`. */
        suspend fun markNotHelpful(
            id: String,
            surface: String,
        ): NetworkResult<FeedNotHelpfulResponse> =
            safeApiCall {
                api.notHelpful(id, FeedNotHelpfulRequest(surface = surface))
            }

        /** `PATCH /api/posts/:id/solve`. */
        suspend fun markSolved(id: String): NetworkResult<FeedSolveResponse> = safeApiCall { api.solve(id) }

        /** `POST /api/posts/seeded/:factId/dismiss`. */
        suspend fun dismissSeededFact(factId: String): NetworkResult<FeedSeededDismissResponse> =
            safeApiCall { api.dismissSeededFact(factId) }

        /** `GET /api/posts/feed-preferences`. */
        suspend fun feedPreferences(): NetworkResult<FeedPreferencesResponse> = safeApiCall { api.feedPreferences() }

        /** `PUT /api/posts/feed-preferences`. */
        suspend fun updateFeedPreferences(body: FeedPreferencesUpdateRequest): NetworkResult<FeedPreferencesResponse> =
            safeApiCall { api.updateFeedPreferences(body) }
    }
