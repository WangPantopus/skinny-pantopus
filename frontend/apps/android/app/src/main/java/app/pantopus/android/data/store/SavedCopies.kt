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
private const val SCHEMA = 2

/**
 * The screens' store on the phone (Instant Screens contract §6 "Saved copy", §5 "At rest on Android"): one file per
 * entry under `cacheDir/screen-store/<account>/`, never in backups. Each file holds an envelope line (schema, app build,
 * when the copy was read, its ETag, topics, kind and staleness) and the reply's JSON on the next line, written atomically (temporary file, sync,
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

        init {
            // An offline upgrade might never open an old household entry: retire it before any screen reads.
            val now = System.currentTimeMillis()
            root.walkTopDown().filter { it.isFile }.forEach { file ->
                if (file.extension == "tmp") {
                    file.delete()
                } else if (file.extension == "json") {
                    val envelope =
                        runCatching {
                            file.bufferedReader().use { reader -> reader.readLine()?.let { envelopes.fromJson(it) } }
                        }.getOrNull()
                    if (!usable(envelope, now)) file.delete()
                }
            }
        }

        private fun usable(
            envelope: Envelope?,
            now: Long,
        ): Boolean {
            if (envelope == null) return false
            return envelope.schema == SCHEMA && envelope.build == build && now - envelope.fetchedAt in 0 until MAX_AGE_MS
        }

        /** One saved entry as read back: the reply, when it was read (wall clock) and its ETag. */
        data class Copy<T>(
            val data: T,
            val fetchedAt: Long,
            val etag: String?,
            val stale: Boolean,
        )

        @JsonClass(generateAdapter = true)
        internal data class Envelope(
            val schema: Int,
            val build: String,
            val fetchedAt: Long,
            val etag: String?,
            val topics: Set<String>? = null,
            val kind: StoreKind? = null,
            val stale: Boolean = false,
        ) {
            val legacy: Boolean get() = topics == null || kind == null

            fun matches(
                topic: String?,
                kinds: Set<StoreKind>,
            ): Boolean =
                kind in kinds ||
                    topics.orEmpty().any {
                        it == topic || (it.endsWith(":*") && topic?.startsWith(it.dropLast(1)) == true)
                    }
        }

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
                val data = if (usable(envelope, now)) moshi.adapter<T>(type).fromJson(text.substring(split + 1)) else null
                if (data == null || envelope == null) {
                    file.delete()
                    null
                } else {
                    // Least recently used goes first: reading counts as use.
                    file.setLastModified(now)
                    Copy(data, envelope.fetchedAt, envelope.etag, envelope.stale)
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

        /** Saves [data] for [key], replacing any older copy, then trims the folder to its budget. Never throws. */
        fun <T : Any> save(
            account: String,
            key: StoreKey<*>,
            data: T,
            fetchedAt: Long,
            etag: String?,
            stale: Boolean,
        ) {
            val type = key.type ?: return
            val target = file(account, key.id)
            try {
                val envelope = Envelope(SCHEMA, build, fetchedAt, etag, key.topics, key.kind, stale)
                write(target, envelope, moshi.adapter<T>(type).toJson(data))
                trim()
            } catch (
                @Suppress("TooGenericExceptionCaught") error: Exception,
            ) {
                // The phone copy is an optimization: a type that can't be written, or a full disk, never breaks a read.
                Timber.w(error, "saved copy not written")
            }
        }

        /** Invalidation also reaches entries whose memory slot has gone, and survives a process restart. */
        fun invalidate(
            account: String,
            topic: String? = null,
            kinds: Set<StoreKind> = emptySet(),
            edited: Boolean = false,
        ) {
            if (topic == null && kinds.isEmpty()) return
            val folder = file(account, "").parentFile ?: return
            folder.listFiles()?.filter { it.extension == "json" }?.forEach { target ->
                try {
                    target.bufferedReader().use { reader ->
                        val envelope = reader.readLine()?.let { envelopes.fromJson(it) } ?: return@use
                        if (!envelope.legacy && !envelope.matches(topic, kinds)) return@use
                        if (edited && !envelope.legacy) {
                            target.delete()
                        } else if (!envelope.stale || (edited && envelope.etag != null)) {
                            // Older schema-2 copies lack topics. Keep their offline content, but require a check.
                            val lastUsed = target.lastModified()
                            write(target, envelope.copy(stale = true, etag = envelope.etag.takeUnless { edited }), reader.readText())
                            target.setLastModified(lastUsed)
                        }
                    }
                } catch (
                    @Suppress("TooGenericExceptionCaught") error: Exception,
                ) {
                    // A copy whose invalidation cannot be recorded must not later look current.
                    target.delete()
                    Timber.w(error, "saved copy invalidation failed")
                }
            }
            trim()
        }

        private fun write(
            target: File,
            envelope: Envelope,
            data: String,
        ) {
            val folder = target.parentFile ?: return
            if (!folder.isDirectory && !folder.mkdirs()) return
            val body = envelopes.toJson(envelope) + "\n" + data
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
