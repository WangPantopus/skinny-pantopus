package app.pantopus.android.ui.screens.inbox.conversation

import app.pantopus.android.BuildConfig

/**
 * Resolves chat attachment URLs for Coil. Upload stores proxy paths like
 * `/api/chat/files/:id`; loaders need an absolute origin and auth (`?token=`).
 */
internal object ChatMediaUrl {
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
        if (token.isEmpty() || !absolute.contains("/api/chat/files/")) return absolute

        val separator = if (absolute.contains("?")) "&" else "?"
        return "$absolute${separator}token=$token"
    }
}
