package app.pantopus.android.data.storage

import android.content.Context
import app.pantopus.android.data.store.SAVED_PAGES_MAX_BYTES
import coil.annotation.ExperimentalCoilApi
import coil.disk.DiskCache
import coil.intercept.Interceptor
import coil.memory.MemoryCache
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.withContext
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
    private val requestGeneration = ThreadLocal<Long?>()
    private var budget = delegate.maxSize
    private val recent = LinkedHashMap<String, Unit>(16, 0.75f, true)

    override val maxSize: Long get() = synchronized(lock) { budget }

    /** Bind the entire fetch/decode to the generation at dispatch, before a disk editor exists. */
    fun requestInterceptor(): Interceptor = Interceptor { chain ->
        val started = synchronized(lock) { generation }
        withContext(requestGeneration.asContextElement(started)) {
            val result = chain.proceed(chain.request)
            if (synchronized(lock) { started != generation }) throw CancellationException("Image cache was cleared")
            result
        }
    }

    /** Coil writes memory after decoding, so that final write needs the same generation check as disk. */
    fun guardMemoryCache(memory: MemoryCache): MemoryCache = object : MemoryCache by memory {
        override fun set(key: MemoryCache.Key, value: MemoryCache.Value) = synchronized(lock) {
            if (currentRequest()) memory[key] = value
        }

        override fun get(key: MemoryCache.Key): MemoryCache.Value? = synchronized(lock) {
            if (currentRequest()) memory[key] else null
        }

        override fun clear() = synchronized(lock) {
            generation++
            memory.clear()
        }
    }

    /** Called only under [lock]; direct, synchronous cache operations belong to the current generation. */
    private fun currentRequest(): Boolean = requestGeneration.get()?.let { it == generation } ?: true

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
            if (!currentRequest()) return@synchronized null
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
            if (!currentRequest()) return@synchronized null
            delegate.openEditor(key)?.let { wrapEditor(key, it) }
        }

    private fun wrapSnapshot(
        key: String,
        snapshot: DiskCache.Snapshot,
    ): DiskCache.Snapshot =
        object : DiskCache.Snapshot by snapshot {
            override fun closeAndOpenEditor(): DiskCache.Editor? =
                synchronized(lock) {
                    if (!currentRequest()) {
                        snapshot.close()
                        return@synchronized null
                    }
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
