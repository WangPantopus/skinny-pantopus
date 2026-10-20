package app.pantopus.android.ui.screens.inbox.conversation

import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.net.ApiOrigin
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.io.File
import java.util.UUID

/**
 * Resolves chat attachment URLs for Coil. Upload stores proxy paths like
 * `/api/chat/files/:id`; loaders need an absolute origin and auth (`?token=`).
 * A token is only ever added for the API origin: message metadata can name
 * any host, including one whose path contains `/api/chat/files/`.
 */
internal object ChatMediaUrl {
    private val chatFilePath = Regex("/api/chat/files/[^/]+")
    private const val CAMERA_PREFIX = "chat-camera-"

    /** Where a file opened from a chat is saved: the viewer app needs a file on the phone. */
    fun openedFilesFolder(cacheDir: File) = File(cacheDir, "chat-files")

    /** A photo taken with the camera for a chat (shared with the camera app through the FileProvider). */
    fun cameraFile(cacheDir: File) = File(cacheDir, "$CAMERA_PREFIX${UUID.randomUUID()}.jpg")

    /**
     * Files opened from chats and photos taken for them go at sign-out (all of them, so nothing of one person's chats
     * stays for the next) and at a later launch (those older than [olderThanMs]: a viewer, or a camera capture the app
     * was restarted for, may still need a newer one).
     */
    fun removeLocalFiles(
        cacheDir: File,
        olderThanMs: Long = 0,
    ) {
        val cutoff = System.currentTimeMillis() - olderThanMs
        val old = { file: File -> olderThanMs == 0L || file.lastModified() < cutoff }
        openedFilesFolder(cacheDir).listFiles()?.filter(old)?.forEach { it.deleteRecursively() }
        cacheDir.listFiles { file -> file.isFile && file.name.startsWith(CAMERA_PREFIX) && old(file) }?.forEach { it.delete() }
    }

    /** Only the authenticated chat proxy provides a bounded thumbnail; external URLs stay originals. */
    fun thumbnail(raw: String): String? {
        val url = resolve(raw)?.toHttpUrlOrNull() ?: return null
        val api = BuildConfig.PANTOPUS_API_BASE_URL.toHttpUrlOrNull() ?: return null
        if (!ApiOrigin(api).matches(url) || !chatFilePath.matches(url.encodedPath)) {
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
