package app.pantopus.android.ui.screens.inbox.conversation

import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.net.ApiOrigin
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * Resolves chat attachment URLs for Coil. Upload stores proxy paths like
 * `/api/chat/files/:id`; loaders need an absolute origin and auth (`?token=`).
 * A token is only ever added for the API origin: message metadata can name
 * any host, including one whose path contains `/api/chat/files/`.
 */
internal object ChatMediaUrl {
    /** Only the authenticated chat proxy provides a bounded thumbnail; external URLs stay originals. */
    fun thumbnail(raw: String): String? {
        val url = resolve(raw)?.toHttpUrlOrNull() ?: return null
        val api = BuildConfig.PANTOPUS_API_BASE_URL.toHttpUrlOrNull() ?: return null
        if (!ApiOrigin(api).matches(url) ||
            url.pathSegments.size != 4 ||
            url.pathSegments.take(3) != listOf("api", "chat", "files") ||
            url.pathSegments.last().isBlank()
        ) {
            return null
        }
        return url.newBuilder().setQueryParameter("variant", "thumbnail").build().toString()
    }

    fun resolve(
        raw: String?,
        accessToken: String? = null,
        apiBaseUrl: String = BuildConfig.PANTOPUS_API_BASE_URL,
    ): String? {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return null

        val absolute =
            when {
                trimmed.startsWith("http://") || trimmed.startsWith("https://") -> trimmed
                trimmed.startsWith("/") -> apiBaseUrl.trimEnd('/') + trimmed
                else -> apiBaseUrl.trimEnd('/') + "/" + trimmed.trimStart('/')
            }

        val token = accessToken?.trim().orEmpty()
        val onApi =
            absolute.toHttpUrlOrNull()?.let { url ->
                apiBaseUrl.toHttpUrlOrNull()?.let { ApiOrigin(it).matches(url) }
            } == true
        if (token.isEmpty() || !onApi || !absolute.contains("/api/chat/files/")) return absolute

        val separator = if (absolute.contains("?")) "&" else "?"
        return "$absolute${separator}token=$token"
    }
}
