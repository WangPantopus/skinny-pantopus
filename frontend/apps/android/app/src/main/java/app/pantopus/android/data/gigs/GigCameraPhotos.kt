package app.pantopus.android.data.gigs

import java.io.File
import java.util.UUID

/**
 * Photos taken with the camera for a task post. The composers copy a photo's bytes and upload them as soon as it's
 * taken, so the file on the phone is only needed until then. They go at sign-out (all of them, so nothing of one
 * person's posts stays for the next) and at a later launch (those older than an hour: a capture the app was
 * restarted for may still need a newer one).
 */
object GigCameraPhotos {
    private const val PREFIX = "gig-camera-"

    /** Where they go: one of the FileProvider's folders. */
    private fun folder(cacheDir: File) = File(cacheDir, "gig-camera")

    /** A new file for the camera app to write into (shared through the FileProvider). */
    fun newFile(cacheDir: File) = File(folder(cacheDir).apply { mkdirs() }, "$PREFIX${UUID.randomUUID()}.jpg")

    fun remove(
        cacheDir: File,
        olderThanMs: Long = 0,
    ) {
        val cutoff = System.currentTimeMillis() - olderThanMs
        // Earlier builds took them at the top of the cache.
        for (dir in listOf(folder(cacheDir), cacheDir)) {
            dir
                .listFiles { file -> file.isFile && file.name.startsWith(PREFIX) && (olderThanMs == 0L || file.lastModified() < cutoff) }
                ?.forEach { it.delete() }
        }
    }
}
