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
import app.pantopus.android.data.api.models.feed.MutedEntitiesResponse
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import app.pantopus.android.data.store.asResult
import app.pantopus.android.data.api.net.conditionalApiCall
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
        private val store: ScreenStore,
    ) {
        /** `POST /api/posts/hide/:id`. */
        suspend fun hidePost(id: String): NetworkResult<FeedActionAckResponse> = safeApiCall { api.hidePost(id) }.feedChanged()

        /** `POST /api/posts/mute`. */
        suspend fun mute(
            entityType: FeedMuteEntityType,
            entityId: String,
        ): NetworkResult<FeedActionAckResponse> =
            safeApiCall {
                api.mute(FeedMuteRequest(entityType = entityType.wireValue, entityId = entityId))
            }.feedChanged()

        /** `GET /api/posts/mute` — who the viewer muted. */
        suspend fun mutedEntities(): NetworkResult<MutedEntitiesResponse> = safeApiCall { api.mutedEntities() }

        /** `DELETE /api/posts/mute`. */
        suspend fun unmute(
            entityType: FeedMuteEntityType,
            entityId: String,
        ): NetworkResult<FeedActionAckResponse> =
            safeApiCall {
                api.unmute(FeedMuteRequest(entityType = entityType.wireValue, entityId = entityId))
            }.feedChanged()

        /** `POST /api/posts/mute/topic`. */
        suspend fun muteTopic(
            postType: String,
            surface: String?,
        ): NetworkResult<FeedActionAckResponse> =
            safeApiCall {
                api.muteTopic(FeedMuteTopicRequest(postType = postType, surface = surface))
            }.feedChanged()

        /** `POST /api/posts/:id/not-helpful`. */
        suspend fun markNotHelpful(
            id: String,
            surface: String,
        ): NetworkResult<FeedNotHelpfulResponse> =
            safeApiCall {
                api.notHelpful(id, FeedNotHelpfulRequest(surface = surface))
            }.feedChanged()

        /** `PATCH /api/posts/:id/solve`. */
        suspend fun markSolved(id: String): NetworkResult<FeedSolveResponse> = safeApiCall { api.solve(id) }.feedChanged()

        /** `POST /api/posts/seeded/:factId/dismiss`. */
        suspend fun dismissSeededFact(factId: String): NetworkResult<FeedSeededDismissResponse> =
            safeApiCall { api.dismissSeededFact(factId) }.feedChanged()

        /** `GET /api/posts/feed-preferences`. */
        suspend fun feedPreferences(force: Boolean = false): NetworkResult<FeedPreferencesResponse> {
            val stored = store.read(StoreKeys.feedPreferences, force) { etag ->
                conditionalApiCall { api.feedPreferencesConditional(etag) }
            }
            return stored.data?.let { NetworkResult.Success(it) } ?: stored.asResult()
        }

        fun feedPreferencesCopy(): Stored<FeedPreferencesResponse> = store.peek(StoreKeys.feedPreferences)

        /** `PUT /api/posts/feed-preferences`. */
        suspend fun updateFeedPreferences(body: FeedPreferencesUpdateRequest): NetworkResult<FeedPreferencesResponse> =
            safeApiCall { api.updateFeedPreferences(body) }.also { result ->
                if (result is NetworkResult.Success) {
                    store.remove(StoreKeys.feedPreferences)
                    store.markEdited(StoreTopics.PROFILE_ME)
                    store.markEdited(StoreTopics.POSTS)
                }
            }

        private fun <T> NetworkResult<T>.feedChanged(): NetworkResult<T> =
            also { if (it is NetworkResult.Success) store.markEdited(StoreTopics.POSTS) }
    }
