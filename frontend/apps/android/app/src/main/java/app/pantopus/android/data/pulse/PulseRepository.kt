package app.pantopus.android.data.pulse

import app.pantopus.android.data.api.models.pulse.PulseAckResponse
import app.pantopus.android.data.api.models.pulse.PulseFeedCopy
import app.pantopus.android.data.api.models.pulse.PulseFeedResponse
import app.pantopus.android.data.api.models.pulse.PulseNewCountResponse
import app.pantopus.android.data.api.models.pulse.PulsePostStatusResponse
import app.pantopus.android.data.api.models.pulse.PulseSeenRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.mapFresh
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PulseApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** One Pulse page query: the view (`nearby` or `following`), the topic filter and the area (null is the viewer's town). */
data class PulseFeedQuery(
    val view: String = VIEW_NEARBY,
    val topic: String? = null,
    val areaId: String? = null,
) {
    companion object {
        const val VIEW_NEARBY = "nearby"
        const val VIEW_FOLLOWING = "following"

        /** Items per read, the first page and "Show earlier". */
        const val PAGE_SIZE = 30
    }
}

/** Wraps [PulseApi]: the first page through the screens' store (saved copy, fresh 2 minutes), the rest straight. */
@Singleton
class PulseRepository
    @Inject
    constructor(
        private val api: PulseApi,
        private val store: ScreenStore,
    ) {
        /** The first page of [query] through the store; [force] reads now (pull to refresh, "↑ N new conversations"). */
        suspend fun feedStored(
            query: PulseFeedQuery,
            force: Boolean = false,
        ): Stored<PulseFeedCopy> =
            store.read(StoreKeys.pulseFeed(query), force) { etag ->
                val readAt = Instant.now().toString()
                conditionalApiCall {
                    api.feedConditional(
                        view = query.view,
                        topic = query.topic,
                        areaId = query.areaId,
                        limit = PulseFeedQuery.PAGE_SIZE,
                        etag = etag,
                    )
                }.mapFresh { PulseFeedCopy(response = it, readAt = readAt) }
            }

        /** The stored first page as it is now (a first frame), without a request. */
        fun feedCopy(query: PulseFeedQuery): PulseFeedCopy? = store.peek(StoreKeys.pulseFeed(query)).data

        /** True while [query]'s first page is fresh and unmarked: coming back reads nothing. */
        fun feedIsCurrent(query: PulseFeedQuery): Boolean = store.isCurrent(StoreKeys.pulseFeed(query))

        /** "Show earlier": the next older items after [before] (the response's `earlier_cursor`), in one group. */
        suspend fun earlier(
            query: PulseFeedQuery,
            before: String,
        ): NetworkResult<PulseFeedResponse> =
            safeApiCall {
                api.feed(
                    view = query.view,
                    topic = query.topic,
                    areaId = query.areaId,
                    earlierBefore = before,
                    limit = PulseFeedQuery.PAGE_SIZE,
                )
            }

        /** How many new conversations wait since [after] (the time the page was read). */
        suspend fun newCount(
            query: PulseFeedQuery,
            after: String?,
        ): NetworkResult<PulseNewCountResponse> = safeApiCall { api.newCount(view = query.view, topic = query.topic, after = after) }

        /** The end card has been on screen: advance the last-seen marker for [view] through [through]. */
        suspend fun markSeen(
            view: String,
            through: String,
        ): NetworkResult<PulseAckResponse> =
            safeApiCall { api.seen(PulseSeenRequest(view = view, through = through)) }.also {
                if (it is NetworkResult.Success) store.markEdited("pulse:seen:$view")
            }

        /** "Keep open 7 more days" on the asker's own open Ask (contract 2.12). */
        suspend fun keepOpen(postId: String): NetworkResult<PulsePostStatusResponse> = safeApiCall { api.keepOpen(postId) }.postsChanged()

        /** "Close" on the asker's own open Ask (contract 2.12). */
        suspend fun close(postId: String): NetworkResult<PulsePostStatusResponse> = safeApiCall { api.close(postId) }.postsChanged()

        private fun <T> NetworkResult<T>.postsChanged(): NetworkResult<T> =
            also { if (it is NetworkResult.Success) store.markEdited(StoreTopics.POSTS) }

        companion object {
            /** The server's `code` for a refused keep-open or close (`ALREADY_KEPT_OPEN`, `ASK_ENDED`, …), when it sent one. */
            fun refusalCode(error: NetworkError): String? {
                val body =
                    when (error) {
                        is NetworkError.ClientError -> error.body
                        is NetworkError.Forbidden -> error.body
                        else -> null
                    } ?: return null
                return runCatching { org.json.JSONObject(body).optString("code") }.getOrNull()?.takeIf { it.isNotBlank() }
            }

            const val ALREADY_KEPT_OPEN = "ALREADY_KEPT_OPEN"
        }
    }
