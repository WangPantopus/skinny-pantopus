package app.pantopus.android.data.storage

import android.app.usage.StorageStatsManager
import android.content.Context
import android.os.Process
import android.os.storage.StorageManager
import app.pantopus.android.data.store.SavedCopies
import app.pantopus.android.data.store.ScreenStore
import coil.annotation.ExperimentalCoilApi
import coil.imageLoader
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import timber.log.Timber
import java.io.File
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToLong

/**
 * What Pantopus keeps on this phone (Instant Screens contract §7, Storage & data): photos and images (Coil's disk
 * cache), saved pages (the screens' store on the phone) and drafts and uploads in progress (the refund and stop records
 * kept until they finish). The sizes are the folders Clear cache actually frees, so "Clear cache (60 MB)" frees 60 MB.
 */
@Singleton
class StorageUsage
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val saved: SavedCopies,
        private val store: ScreenStore,
    ) {
        /** Bytes per part. */
        data class Sizes(
            val photos: Long,
            val savedPages: Long,
            val drafts: Long,
            /** Android's cache accounting, including caches outside the two folders this screen clears. */
            val systemCache: Long = 0L,
        ) {
            val total: Long get() = photos + savedPages + drafts

            /** What Clear cache frees. */
            val clearable: Long get() = photos + savedPages
        }

        /** Measures the three parts off the main thread. Never throws: a part that can't be read counts as empty. */
        suspend fun measure(): Sizes =
            withContext(Dispatchers.IO) {
                Sizes(
                    photos = imageBytes(),
                    savedPages = runCatching { saved.sizeBytes() }.getOrDefault(0L),
                    drafts = DRAFT_FOLDERS.sumOf { folderBytes(File(context.noBackupFilesDir, it)) },
                    systemCache = systemCacheBytes(),
                )
            }

        /**
         * Clear cache: photos and saved pages go, from memory too (the store's wipe moves its generation, so a reply in
         * flight can't put a page back). Drafts, uploads in progress, unfinished actions, the sign-in and settings stay.
         */
        @OptIn(ExperimentalCoilApi::class)
        suspend fun clearCache() {
            withContext(Dispatchers.IO) {
                store.wipe()
                runCatching {
                    context.imageLoader.memoryCache?.clear()
                    context.imageLoader.diskCache?.clear()
                }.onFailure { Timber.w(it, "Clear cache could not clear the image caches") }
            }
        }

        /**
         * A lower limit takes effect now, including images downloaded afterwards in the same process.
         */
        @OptIn(ExperimentalCoilApi::class)
        suspend fun fitImages(limitBytes: Long) {
            withContext(Dispatchers.IO) {
                runCatching { (context.imageLoader.diskCache as? ImageDiskCache)?.setLimit(limitBytes) }
                    .onFailure { Timber.w(it, "A lower storage limit could not clear the image cache") }
            }
        }

        /** Querying our own UID requires no usage-access permission; folder sizes remain the clearable breakdown. */
        private fun systemCacheBytes(): Long =
            runCatching {
                val manager = context.getSystemService(StorageStatsManager::class.java)
                manager.queryStatsForUid(StorageManager.UUID_DEFAULT, Process.myUid()).cacheBytes
            }.getOrDefault(0L)

        @OptIn(ExperimentalCoilApi::class)
        private fun imageBytes(): Long = runCatching { context.imageLoader.diskCache?.size ?: 0L }.getOrDefault(0L)

        private fun folderBytes(folder: File): Long = folder.walkBottomUp().filter { it.isFile }.sumOf { it.length() }

        companion object {
            /** `noBackupFilesDir` folders of unfinished actions: PersistentPendingRefundStore, PendingGigStopStore. */
            private val DRAFT_FOLDERS = listOf("pending-refunds", "pending-gig-stops")

            private const val KB = 1_000L
            private const val MB = 1_000_000L
            private const val GB = 1_000_000_000L
            private const val ONE_DECIMAL_BELOW = 10

            /**
             * "62 MB", "1.5 MB", "512 KB", "0 KB": decimal units, as the phone's own storage screens count them. Any
             * non-zero amount under 1 KB shows as 1 KB.
             */
            fun format(bytes: Long): String =
                when {
                    bytes <= 0L -> "0 KB"
                    bytes < MB -> "${maxOf(1L, (bytes.toDouble() / KB).roundToLong())} KB"
                    bytes < GB -> scaled(bytes, MB, "MB")
                    else -> scaled(bytes, GB, "GB")
                }

            private fun scaled(
                bytes: Long,
                unit: Long,
                label: String,
            ): String {
                val value = bytes.toDouble() / unit
                if (value >= ONE_DECIMAL_BELOW) return "${value.roundToLong()} $label"
                val text = String.format(Locale.getDefault(), "%.1f", value)
                return "${text.removeSuffix("0").removeSuffix(".").removeSuffix(",")} $label"
            }
        }
    }
