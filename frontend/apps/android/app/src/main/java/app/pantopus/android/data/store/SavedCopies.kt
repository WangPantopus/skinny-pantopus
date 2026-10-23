package app.pantopus.android.data.store

import android.content.Context
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.storage.ChatFileCipher
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
private const val CHAT_MAX_BYTES = 5L * 1024 * 1024
private const val CHAT_MAX_THREADS = 20

private const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000

/**
 * The envelope's format. A file written in another format is deleted instead of read. 3: Place copies keep their Ballot
 * fields; a schema-2 copy lost them, and revalidating it with its ETag (a 304) would keep showing it without them.
 */
private const val SCHEMA = 3

/**
 * The screens' store on the phone (Instant Screens contract §6 "Saved copy", §5 "At rest on Android"): one file per
 * entry under `cacheDir/screen-store/<account>/`, never in backups. Each file holds an envelope line (schema, app build,
 * when the copy was read, its ETag, topics, kind and staleness) and the reply's JSON on the next line, written atomically
 * (temporary file, sync, rename) as [app.pantopus.android.data.payments.PersistentPendingRefundStore] does. Names are hashes:
 * no account id, home id or token appears in them.
 *
 * At most 20 MB, the least recently used first; nothing older than 7 days, from another app build or in another format
 * is read, and a file that doesn't decode is deleted. Recent conversations use Keystore-encrypted `.enc` files within
 * a separate 5 MB / 20-window budget; schema-compatible chat copies survive app updates. Their authenticated scope
 * includes the account and key hashes. Sign-out, an account switch and Clear cache delete everything.
 */
@Singleton
class SavedCopies
    internal constructor(
        private val root: File,
        private val moshi: Moshi,
        private val build: String,
        private val chatCipher: ChatFileCipher? = null,
    ) {
        @Inject
        constructor(
            @ApplicationContext context: Context,
            moshi: Moshi,
            chatCipher: ChatFileCipher,
        ) : this(
            File(context.cacheDir, "screen-store"),
            moshi,
            // Version name and code stay the same between builds; the commit doesn't. An older build's copy may lack
            // fields this build reads, and revalidating it (a 304) would keep it.
            "${BuildConfig.VERSION_NAME}+${BuildConfig.VERSION_CODE}+${BuildConfig.GIT_COMMIT}",
            chatCipher,
        )

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
            val compatible = envelope.kind == StoreKind.CONVERSATION || envelope.build == build
            return envelope.schema == SCHEMA && compatible && now - envelope.fetchedAt in 0 until MAX_AGE_MS
        }

        /** One saved entry as read back: the reply, when it was read (wall clock) and its ETag. */
        data class Copy<T>(
            val data: T,
            val fetchedAt: Long,
            val etag: String?,
            val stale: Boolean,
            /** Written before copies carried topics and kind: any mark applies to it. */
            val legacy: Boolean = false,
        )

        /** One invalidation: a topic or kinds, own edit or not, for copies fetched at or before [upTo]. */
        data class Mark(
            val topic: String? = null,
            val kinds: Set<StoreKind> = emptySet(),
            val edited: Boolean = false,
            val upTo: Long = Long.MAX_VALUE,
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
            kind: StoreKind? = null,
        ): Copy<T>? {
            val file = file(account, keyId, kind == StoreKind.CONVERSATION)
            if (!file.isFile) return null
            return try {
                val text = read(file)
                val split = text.indexOf('\n')
                val envelope = if (split > 0) envelopes.fromJson(text.substring(0, split)) else null
                val data = if (usable(envelope, now)) moshi.adapter<T>(type).fromJson(text.substring(split + 1)) else null
                if (data == null || envelope == null) {
                    file.delete()
                    null
                } else {
                    // Least recently used goes first: reading counts as use.
                    file.setLastModified(now)
                    Copy(data, envelope.fetchedAt, envelope.etag, envelope.stale, envelope.legacy)
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
            val target = file(account, key.id, key.kind == StoreKind.CONVERSATION)
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

        /**
         * Invalidation also reaches entries whose memory slot has gone, and survives a process restart. Runs off the
         * caller's thread; [guard] wraps each file's work (the store's lock and wipe check), one file at a time.
         */
        fun invalidate(
            account: String,
            mark: Mark,
            guard: (() -> Unit) -> Unit = { it() },
        ) {
            if (mark.topic == null && mark.kinds.isEmpty()) return
            val folder = file(account, "").parentFile ?: return
            folder.listFiles()?.filter { it.extension in setOf("json", "enc") }?.forEach {
                    target ->
                guard { invalidateFile(target, mark) }
            }
            guard { trim() }
        }

        private fun invalidateFile(
            target: File,
            mark: Mark,
        ) {
            if (!target.isFile) return
            val edited = mark.edited
            try {
                read(target).reader().buffered().use { reader ->
                    val envelope = reader.readLine()?.let { envelopes.fromJson(it) } ?: return@use
                    // A copy saved after the mark came from a later read and keeps its own state.
                    if (envelope.fetchedAt > mark.upTo) return@use
                    if (!envelope.legacy && !envelope.matches(mark.topic, mark.kinds)) return@use
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

        private fun write(
            target: File,
            envelope: Envelope,
            data: String,
        ) {
            val folder = target.parentFile ?: return
            if (!folder.isDirectory && !folder.mkdirs()) return
            val body = (envelopes.toJson(envelope) + "\n" + data).toByteArray(Charsets.UTF_8)
            val bytes = if (target.extension == "enc") requireNotNull(chatCipher).encrypt(body, scope(target)) else body
            val temporary = File.createTempFile("entry-", ".tmp", folder)
            try {
                FileOutputStream(temporary).use { output ->
                    output.write(bytes)
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
            file(account, keyId, encrypted = true).delete()
        }

        /** Sign-out, a revoked session, an account switch and Clear cache: every account's saved pages go. */
        fun deleteAll() {
            root.deleteRecursively()
        }

        /** Bytes the saved pages take now (the Storage & data screen). */
        fun sizeBytes(): Long = root.walkBottomUp().filter { it.isFile }.sumOf { it.length() }

        /** Least recently used first, until the folder fits [SAVED_PAGES_MAX_BYTES]. */
        private fun trim() {
            val files = root.walkBottomUp().filter { it.isFile && it.extension in setOf("json", "enc") }.toMutableList()
            val chats = files.filter { it.extension == "enc" }.sortedBy { it.lastModified() }
            var chatBytes = chats.sumOf { it.length() }
            var chatCount = chats.size
            chats.forEach { file ->
                if (chatBytes > CHAT_MAX_BYTES || chatCount > CHAT_MAX_THREADS) {
                    chatBytes -= file.length()
                    chatCount--
                    file.delete()
                    files.remove(file)
                }
            }
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
            encrypted: Boolean = false,
        ): File {
            val extension = if (encrypted) "enc" else "json"
            return File(File(root, hash("${BuildConfig.PANTOPUS_API_BASE_URL}|$account")), "${hash(keyId)}.$extension")
        }

        private fun scope(file: File): String = file.relativeTo(root).path

        private fun read(file: File): String {
            val bytes = file.readBytes()
            val plain = if (file.extension == "enc") requireNotNull(chatCipher).decrypt(bytes, scope(file)) else bytes
            return plain.toString(Charsets.UTF_8)
        }

        private fun hash(value: String): String =
            MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }.take(HASH_CHARS)

        private companion object {
            const val HASH_CHARS = 32
        }
    }
