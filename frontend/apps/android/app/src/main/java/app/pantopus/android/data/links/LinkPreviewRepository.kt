package app.pantopus.android.data.links

import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import timber.log.Timber
import java.util.concurrent.TimeUnit

/** Open-Graph metadata resolved for a chat link-preview card (A15.2 `.link-bubble`). */
data class LinkPreview(
    val url: String,
    val host: String,
    val title: String,
    val description: String?,
    val imageUrl: String?,
)

/**
 * Fetches + caches Open-Graph metadata for http(s) URLs found in chat
 * message text. Deliberately NOT wired to the authenticated Retrofit
 * stack — previews hit arbitrary third-party hosts, so a bare
 * [OkHttpClient] with no auth interceptors is built locally (no token
 * leakage, 5s timeouts). Only the first ~120KB of the body is read; the
 * `<head>` metadata always fits well within that.
 *
 * Results (including failures, cached as null) live in an in-memory
 * [LruCache] so scrolling back over the same message never re-fetches.
 */
@javax.inject.Singleton
class LinkPreviewRepository
    @javax.inject.Inject
    constructor() {
        private val client =
            OkHttpClient
                .Builder()
                .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .callTimeout(TIMEOUT_SECONDS * 2, TimeUnit.SECONDS)
                .build()

        // Value is Optional-shaped: a cached miss is stored as a sentinel so
        // failed URLs aren't re-fetched on every recomposition.
        private val cache = LruCache<String, CachedPreview>(CACHE_SIZE)

        private data class CachedPreview(val preview: LinkPreview?)

        /**
         * Resolve Open-Graph metadata for [url], or null when the page
         * can't be fetched / carries no usable title. Negative results are
         * cached too.
         */
        suspend fun preview(url: String): LinkPreview? {
            if (!url.startsWith("http://") && !url.startsWith("https://")) return null
            synchronized(cache) { cache.get(url) }?.let { return it.preview }
            val resolved =
                withContext(Dispatchers.IO) {
                    runCatching { fetch(url) }
                        .onFailure { Timber.d("link preview failed for $url: ${it.message}") }
                        .getOrNull()
                }
            synchronized(cache) { cache.put(url, CachedPreview(resolved)) }
            return resolved
        }

        private fun fetch(url: String): LinkPreview? {
            val request =
                Request
                    .Builder()
                    .url(url)
                    .header("Accept", "text/html")
                    .header("User-Agent", USER_AGENT)
                    .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body ?: return null
                // Read at most MAX_BODY_BYTES — og:* tags live in <head>.
                val source = body.source()
                source.request(MAX_BODY_BYTES)
                val html = source.buffer.snapshot().utf8()
                return parse(url, html)
            }
        }

        private fun parse(
            url: String,
            html: String,
        ): LinkPreview? {
            val title =
                metaContent(html, "og:title")
                    ?: TITLE_TAG.find(html)?.groupValues?.get(1)?.let(::decodeEntities)?.trim()
            if (title.isNullOrBlank()) return null
            val host = runCatching { java.net.URI(url).host }.getOrNull()?.removePrefix("www.") ?: return null
            return LinkPreview(
                url = url,
                host = host,
                title = title,
                description = metaContent(html, "og:description"),
                imageUrl = metaContent(html, "og:image")?.takeIf { it.startsWith("http") },
            )
        }

        /** `<meta property="og:x" content="…">` in either attribute order. */
        private fun metaContent(
            html: String,
            property: String,
        ): String? {
            val patterns =
                listOf(
                    Regex(
                        "<meta[^>]+(?:property|name)\\s*=\\s*[\"']$property[\"'][^>]+content\\s*=\\s*[\"']([^\"']+)[\"']",
                        RegexOption.IGNORE_CASE,
                    ),
                    Regex(
                        "<meta[^>]+content\\s*=\\s*[\"']([^\"']+)[\"'][^>]+(?:property|name)\\s*=\\s*[\"']$property[\"']",
                        RegexOption.IGNORE_CASE,
                    ),
                )
            return patterns
                .firstNotNullOfOrNull { it.find(html)?.groupValues?.get(1) }
                ?.let(::decodeEntities)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
        }

        private fun decodeEntities(raw: String): String =
            raw
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&#x27;", "'")
                .replace("&nbsp;", " ")

        private companion object {
            const val TIMEOUT_SECONDS = 5L
            const val CACHE_SIZE = 50
            const val MAX_BODY_BYTES = 120L * 1024L
            const val USER_AGENT = "Mozilla/5.0 (Linux; Android) PantopusLinkPreview/1.0"
            val TITLE_TAG = Regex("<title[^>]*>([^<]+)</title>", RegexOption.IGNORE_CASE)
        }
    }
