package app.pantopus.android.data.links

import android.util.LruCache
import app.pantopus.android.data.api.models.links.LinkPreviewResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.LinkPreviewApi
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/** Preview text for a chat link-preview card (A15.2 `.link-bubble`). */
data class LinkPreview(
    val url: String,
    /** The page's site name, else the link's host without `www.`. */
    val site: String,
    val title: String?,
    val description: String?,
)

/**
 * Previews for http(s) URLs found in chat message text, read through
 * `GET /api/link-preview`. The server reads the page, so this device never
 * contacts the linked host and whoever controls a link can't learn
 * recipients' IP addresses. Text only: the server never offers the page's
 * image.
 *
 * Settled answers (a preview, an invalid or blocked link, a page that isn't
 * HTML, nothing to show) live in an in-memory [LruCache] so scrolling back
 * over the same message never asks again. A busy server, server trouble or
 * no connection isn't cached: the link's next appearance asks again.
 */
@javax.inject.Singleton
class LinkPreviewRepository
    @javax.inject.Inject
    constructor(
        private val api: LinkPreviewApi,
    ) {
        private val cache = LruCache<String, CachedPreview>(CACHE_SIZE)

        private data class CachedPreview(val preview: LinkPreview?)

        /**
         * The preview for [url]: success with null when the link has no card
         * for good, failure when the answer may change.
         */
        suspend fun preview(url: String): Result<LinkPreview?> {
            if (!url.startsWith("http://", true) && !url.startsWith("https://", true)) return Result.success(null)
            synchronized(cache) { cache.get(url) }?.let { return Result.success(it.preview) }
            val preview =
                when (val result = safeApiCall { api.preview(url) }) {
                    is NetworkResult.Success -> result.data.toPreview(url)
                    is NetworkResult.Failure -> {
                        // An invalid or blocked link (400), or not a web page (422), is settled.
                        if (result.error.code !in SETTLED_FAILURES) return Result.failure(result.error)
                        null
                    }
                }
            synchronized(cache) { cache.put(url, CachedPreview(preview)) }
            return Result.success(preview)
        }

        /** A card needs a title or a description. */
        private fun LinkPreviewResponse.toPreview(url: String): LinkPreview? {
            val title = title.nonBlank()
            val description = description.nonBlank()
            if (title == null && description == null) return null
            val host = url.toHttpUrlOrNull()?.host?.removePrefix("www.") ?: url
            return LinkPreview(url = url, site = siteName.nonBlank() ?: host, title = title, description = description)
        }

        private fun String?.nonBlank(): String? = this?.trim()?.takeIf { it.isNotEmpty() }

        private companion object {
            const val CACHE_SIZE = 50
            val SETTLED_FAILURES = setOf(400, 422)
        }
    }
