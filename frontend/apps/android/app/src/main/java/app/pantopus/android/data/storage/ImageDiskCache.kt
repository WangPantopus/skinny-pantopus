package app.pantopus.android.data.storage

import android.content.Context
import app.pantopus.android.data.store.SAVED_PAGES_MAX_BYTES
import coil.disk.DiskCache
import java.io.File

/** Contract §6 "Images": anything not fetched again for 30 days goes. */
private const val UNUSED_MS = 30L * 24 * 60 * 60 * 1000

/** Photos always get room for a screenful, whatever the limit. */
private const val MIN_PHOTO_BYTES = 30L * StorageLimit.BYTES_PER_MEGABYTE

/** DiskLruCache's own bookkeeping files; everything else in the folder is an entry's data. */
private val JOURNAL_FILES = setOf("journal", "journal.tmp", "journal.bkp")

/**
 * Coil's disk cache inside the one storage limit (Instant Screens contract §6 "Images", founder decision 6): photos get
 * what the saved pages leave of the limit, least recently used first, and images not fetched again for 30 days are
 * deleted before the cache opens. Coil builds it once per process, so a changed limit sizes it from the next launch.
 */
object ImageDiskCache {
    /** Under `cacheDir`, as before (the system's own "Clear cache" empties it too). */
    const val DIRECTORY = "image_cache"

    fun build(
        context: Context,
        limitBytes: Long,
        now: Long = System.currentTimeMillis(),
    ): DiskCache {
        val directory = File(context.cacheDir, DIRECTORY)
        sweep(directory, now)
        return DiskCache
            .Builder()
            .directory(directory)
            .maxSizeBytes(photoBudget(limitBytes))
            .build()
    }

    /** What photos may use of [limitBytes]: the limit less the saved pages' cap. */
    fun photoBudget(limitBytes: Long): Long = (limitBytes - SAVED_PAGES_MAX_BYTES).coerceAtLeast(MIN_PHOTO_BYTES)

    /**
     * Entries written more than 30 days ago go before the cache opens: both of an entry's files at once, never the
     * journal (the cache drops an entry whose files are gone when it next reads it).
     */
    private fun sweep(
        directory: File,
        now: Long,
    ) {
        val files = directory.listFiles()?.filter { it.isFile && it.name !in JOURNAL_FILES } ?: return
        files
            .groupBy { it.name.substringBefore('.') }
            .values
            .filter { entry -> entry.all { now - it.lastModified() > UNUSED_MS } }
            .flatten()
            .forEach { it.delete() }
    }
}
