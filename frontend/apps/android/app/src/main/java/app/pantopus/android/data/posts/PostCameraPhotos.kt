package app.pantopus.android.data.posts

import java.io.File
import java.util.UUID

/**
 * Photos taken with the camera for a post. The composer reads a photo's bytes as soon as it's taken and deletes the
 * file, so one is left only if the app stopped in between. Those go at sign-out (all of them, so nothing of one
 * person's posts stays for the next) and at a later launch (those older than an hour: a capture the app was restarted
 * for may still need a newer one). Like `GigCameraPhotos`.
 */
object PostCameraPhotos {
    private const val PREFIX = "post-camera-"

    /** Where they go: one of the FileProvider's folders. */
    private fun folder(cacheDir: File) = File(cacheDir, "post-camera")

    /** A new file for the camera app to write into (shared through the FileProvider). */
    fun newFile(cacheDir: File) = File(folder(cacheDir).apply { mkdirs() }, "$PREFIX${UUID.randomUUID()}.jpg")

    fun remove(
        cacheDir: File,
        olderThanMs: Long = 0,
    ) {
        val cutoff = System.currentTimeMillis() - olderThanMs
        folder(cacheDir)
            .listFiles { file -> file.isFile && file.name.startsWith(PREFIX) && (olderThanMs == 0L || file.lastModified() < cutoff) }
            ?.forEach { it.delete() }
    }
}
