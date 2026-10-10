package app.pantopus.android.data.storage

import android.content.Context
import app.pantopus.android.data.store.SAVED_PAGES_MAX_BYTES
import coil.annotation.ExperimentalCoilApi
import coil.disk.DiskCache
import java.io.File

/** Contract §6: remove images not opened in 30 days. */
private const val UNUSED_MS = 30L * 24 * 60 * 60 * 1000
private const val MAX_TRACKED_KEYS = 4096
private val JOURNAL_FILES = setOf("journal", "journal.tmp", "journal.bkp")

/**
 * Coil still owns its journal and files. This wrapper rejects empty image bodies, records use for the 30-day sweep,
 * and enforces a lowered limit immediately, including subsequent writes in the same process.
 */
@OptIn(ExperimentalCoilApi::class)
class ImageDiskCache private constructor(
    private val delegate: DiskCache,
) : DiskCache by delegate {
    private val lock = Any()
    private var generation = 0L
    private var budget = delegate.maxSize
    private val recent = LinkedHashMap<String, Unit>(16, 0.75f, true)

    override val maxSize: Long get() = synchronized(lock) { budget }

    /** Coil's capacity is immutable; an increase uses the larger capacity at next launch. */
    fun setLimit(limitBytes: Long) =
        synchronized(lock) {
            val next = photoBudget(limitBytes).coerceAtMost(delegate.maxSize)
            if (next < budget) clear()
            budget = next
        }

    override fun clear() =
        synchronized(lock) {
            generation++
            recent.clear()
            delegate.clear()
        }

    override fun openSnapshot(key: String): DiskCache.Snapshot? =
        synchronized(lock) {
            delegate.openSnapshot(key)?.let { snapshot ->
                if (snapshot.data.toFile().length() == 0L) {
                    snapshot.close()
                    delegate.remove(key)
                    null
                } else {
                    recent[key] = Unit
                    snapshot.data.toFile().setLastModified(System.currentTimeMillis())
                    wrapSnapshot(key, snapshot)
                }
            }
        }

    override fun openEditor(key: String): DiskCache.Editor? =
        synchronized(lock) {
            delegate.openEditor(key)?.let { wrapEditor(key, it) }
        }

    private fun wrapSnapshot(
        key: String,
        snapshot: DiskCache.Snapshot,
    ): DiskCache.Snapshot =
        object : DiskCache.Snapshot by snapshot {
            override fun closeAndOpenEditor(): DiskCache.Editor? =
                synchronized(lock) {
                    snapshot.closeAndOpenEditor()?.let { wrapEditor(key, it) }
                }
        }

    private fun wrapEditor(
        key: String,
        editor: DiskCache.Editor,
    ): DiskCache.Editor {
        val started = generation
        return object : DiskCache.Editor by editor {
            override fun commit() =
                synchronized(lock) {
                    if (started != generation) {
                        // clear() can already have detached this editor from Coil's journal.
                        runCatching { editor.abort() }
                        Unit
                    } else if (editor.data.toFile().length() == 0L) {
                        editor.abort()
                    } else {
                        editor.commit()
                        recent[key] = Unit
                        trim()
                    }
                }

            override fun commitAndOpenSnapshot(): DiskCache.Snapshot? =
                synchronized(lock) {
                    commit()
                    if (started == generation) openSnapshot(key) else null
                }
        }
    }

    /** After lowering the limit every entry is known here; Coil handles the original launch capacity itself. */
    private fun trim() {
        val iterator = recent.keys.iterator()
        while ((delegate.size > budget || recent.size > MAX_TRACKED_KEYS) && iterator.hasNext()) {
            delegate.remove(iterator.next())
            iterator.remove()
        }
    }

    companion object {
        const val DIRECTORY = "image_cache"

        fun build(
            context: Context,
            limitBytes: Long,
            now: Long = System.currentTimeMillis(),
        ): ImageDiskCache {
            val directory = File(context.cacheDir, DIRECTORY)
            sweep(directory, now)
            return ImageDiskCache(DiskCache.Builder().directory(directory).maxSizeBytes(photoBudget(limitBytes)).build())
        }

        fun photoBudget(limitBytes: Long): Long = (limitBytes - SAVED_PAGES_MAX_BYTES).coerceAtLeast(1L)

        private fun sweep(
            directory: File,
            now: Long,
        ) {
            val files = directory.listFiles()?.filter { it.isFile && it.name !in JOURNAL_FILES } ?: return
            files.groupBy { it.name.substringBefore('.') }.values
                .filter { entry -> entry.all { now - it.lastModified() > UNUSED_MS } }
                .flatten().forEach { it.delete() }
        }
    }
}
