package app.pantopus.android.data.pulse

import app.pantopus.android.data.api.models.pulse.PulsePostStatusResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PulseApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreTopics
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [PulseApi]. An Ask kept open or closed changes the lists that show it, so both mark posts edited. */
@Singleton
class PulseRepository
    @Inject
    constructor(
        private val api: PulseApi,
        private val store: ScreenStore,
    ) {
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
