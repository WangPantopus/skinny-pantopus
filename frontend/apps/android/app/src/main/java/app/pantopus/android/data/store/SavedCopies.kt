package app.pantopus.android.data.store

import android.content.Context
import app.pantopus.android.BuildConfig
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import java.io.File
import java.io.FileOutputStream
import java.lang.reflect.Type
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

/** Contract §6 "Saved copy": at most 20 MB of saved pages (photos get the rest of the storage limit)… */
const val SAVED_PAGES_MAX_BYTES = 20L * 1024 * 1024

/** …and nothing older than 7 days is read (a saved household copy is shown for at most 7 days, contract §5). */
private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

/** The envelope's format. A file written in another format is deleted instead of read. */
private const val SCHEMA = 1

/**
 * The screens' store on the phone (Instant Screens contract §6 "Saved copy", §5 "At rest on Android"): one file per
 * entry under `cacheDir/screen-store/<account>/`, never in backups. Each file holds an envelope line (schema, app build,
 * when the copy was read, its ETag) and the reply's JSON on the next line, written atomically (temporary file, sync,
 * rename) as [app.pantopus.android.data.payments.PersistentPendingRefundStore] does. File and folder names are hashes:
 * no account id, home id or token appears in them.
 *
 * At most 20 MB, the least recently used first; nothing older than 7 days, from another app build or in another format
 * is read, and a file that doesn't decode is deleted. Sign-out, an account switch and Clear cache delete everything.
 */
@Singleton
class SavedCopies
    internal constructor(
        private val root: File,
        private val moshi: Moshi,
        private val build: String,
    ) {
        @Inject
        constructor(
            @ApplicationContext context: Context,
            moshi: Moshi,
        ) : this(File(context.cacheDir, "screen-store"), moshi, "${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}")

        private val envelopes = moshi.adapter(Envelope::class.java)

        /** One saved entry as read back: the reply, when it was read (wall clock) and its ETag. */
        data class Copy<T>(
            val data: T,
            val fetchedAt: Long,
            val etag: String?,
        )

        @JsonClass(generateAdapter = true)
        internal data class Envelope(
            val schema: Int,
            val build: String,
            val fetchedAt: Long,
            val etag: String?,
        )

        /**
         * The saved copy of [keyId] for [account], or null. Small files, read on the caller's thread so a screen's
         * first frame can show it.
         */
        fun <T : Any> load(
            account: String,
            keyId: String,
            type: Type,
            now: Long = System.currentTimeMillis(),
        ): Copy<T>? {
            val file = file(account, keyId)
            if (!file.isFile) return null
            return try {
                val text = file.readText(Charsets.UTF_8)
                val split = text.indexOf('\n')
                val envelope = if (split > 0) envelopes.fromJson(text.substring(0, split)) else null
                val usable =
                    envelope != null &&
                        envelope.schema == SCHEMA &&
                        envelope.build == build &&
                        now - envelope.fetchedAt in 0 until MAX_AGE_MS
                val data = if (usable) moshi.adapter<T>(type).fromJson(text.substring(split + 1)) else null
                if (data == null || envelope == null) {
                    file.delete()
                    null
                } else {
                    // Least recently used goes first: reading counts as use.
                    file.setLastModified(now)
                    Copy(data, envelope.fetchedAt, envelope.etag)
                }
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // A copy that doesn't decode (or can't be read) is deleted, never shown.
                Timber.w(error, "saved copy dropped")
                file.delete()
                null
            }
        }

        /** Saves [data] for [keyId], replacing any older copy, then trims the folder to its budget. Never throws. */
        fun <T : Any> save(
            account: String,
            keyId: String,
            type: Type,
            data: T,
            fetchedAt: Long,
            etag: String?,
        ) {
            val target = file(account, keyId)
            val folder = target.parentFile ?: return
            try {
                if (!folder.isDirectory && !folder.mkdirs()) return
                val body = envelopes.toJson(Envelope(SCHEMA, build, fetchedAt, etag)) + "\n" + moshi.adapter<T>(type).toJson(data)
                val temporary = File.createTempFile("entry-", ".tmp", folder)
                try {
                    FileOutputStream(temporary).use { output ->
                        output.write(body.toByteArray(Charsets.UTF_8))
                        output.fd.sync()
                    }
                    Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
                } finally {
                    temporary.delete()
                }
                trim()
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // The phone copy is an optimization: a type that can't be written, or a full disk, never breaks a read.
                Timber.w(error, "saved copy not written")
            }
        }

        /** Deletes the saved copy of [keyId] (access ended, the entry was removed). */
        fun delete(
            account: String,
            keyId: String,
        ) {
            file(account, keyId).delete()
        }

        /** Sign-out, a revoked session, an account switch and Clear cache: every account's saved pages go. */
        fun deleteAll() {
            root.deleteRecursively()
        }

        /** Bytes the saved pages take now (the Storage & data screen). */
        fun sizeBytes(): Long = root.walkBottomUp().filter { it.isFile }.sumOf { it.length() }

        /** Least recently used first, until the folder fits [SAVED_PAGES_MAX_BYTES]. */
        private fun trim() {
            val files = root.walkBottomUp().filter { it.isFile && it.name.endsWith(".json") }.toMutableList()
            var total = files.sumOf { it.length() }
            if (total <= SAVED_PAGES_MAX_BYTES) return
            files.sortBy { it.lastModified() }
            for (file in files) {
                if (total <= SAVED_PAGES_MAX_BYTES) break
                total -= file.length()
                file.delete()
            }
        }

        private fun file(
            account: String,
            keyId: String,
        ): File = File(File(root, hash("${BuildConfig.PANTOPUS_API_BASE_URL}|$account")), "${hash(keyId)}.json")

        private fun hash(value: String): String =
            MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }.take(HASH_CHARS)

        private companion object {
            const val HASH_CHARS = 32
        }
    }
