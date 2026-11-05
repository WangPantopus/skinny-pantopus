package app.pantopus.android.data.crewday

import java.io.File
import java.util.UUID

/**
 * Photos the crew takes with the camera for a finished home (Crew Day screen 17). The page reads a photo's bytes as
 * soon as it's taken and deletes the file, so one is left only if the app stopped in between. Those go at sign-out and
 * at a later launch (those older than an hour). Like `PostCameraPhotos`.
 */
object CrewDayCameraPhotos {
    private const val PREFIX = "crew-day-camera-"

    /** Where they go: one of the FileProvider's folders (`xml/file_paths.xml`). */
    private fun folder(cacheDir: File) = File(cacheDir, "crew-day-camera")

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
